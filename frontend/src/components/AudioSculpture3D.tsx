"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreatState } from "@/types";

interface AudioSculpture3DProps {
  analyserNode: AnalyserNode | null;
  threatState: ThreatState;
  riskScore: number;
  isLive?: boolean;
  docked?: boolean;
}

export const AudioSculpture3D: React.FC<AudioSculpture3DProps> = ({
  analyserNode,
  threatState,
  riskScore,
  isLive = false,
  docked = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(analyserNode);
  const threatRef = useRef<ThreatState>(threatState);
  const riskRef = useRef<number>(riskScore);

  useEffect(() => {
    analyserRef.current = analyserNode;
  }, [analyserNode]);

  useEffect(() => {
    threatRef.current = threatState;
  }, [threatState]);

  useEffect(() => {
    riskRef.current = riskScore;
  }, [riskScore]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 450;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // 2. Custom GLSL Shader for 3D Morphing Liquid-Metal Acoustic Sphere
    const vertexShader = `
      uniform float uTime;
      uniform float uAudioFreq;
      uniform float uBass;
      uniform float uTreble;
      uniform float uThreatLevel;
      
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vPosition;
      varying float vDisplacement;

      // GLSL Simplex Noise 3D Implementation
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      
      float snoise(vec3 v){
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        i = mod(i, 289.0 );
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        
        // Multi-layered fluid acoustic noise displacement
        float speed = uTime * 0.8;
        vec3 p = position;
        
        // Base liquid organic ripple
        float n1 = snoise(p * 1.2 + vec3(speed * 0.4, speed * 0.3, speed * 0.2));
        
        // High-frequency treble ripple
        float n2 = snoise(p * 3.4 - vec3(speed * 0.8, speed * 0.5, speed * 0.6));
        
        // Audio reactive displacement amplitude
        float audioPulsation = uBass * 0.55 + uTreble * 0.45;
        float threatSpike = uThreatLevel * 0.7;
        
        float displacement = (n1 * 0.15) + (n2 * 0.08 * (1.0 + uAudioFreq * 2.0));
        displacement += (n1 * audioPulsation * 0.5);
        displacement += (abs(n2) * threatSpike * 0.6); // sharp erupting spikes on clone threat
        
        vDisplacement = displacement;
        vec3 newPosition = position + normal * displacement;
        
        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform vec3 uThreatColor;
      uniform vec3 uBaseColor;
      uniform float uThreatLevel;
      uniform float uAudioFreq;
      
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vPosition;
      varying float vDisplacement;

      void main() {
        // Fresnel metallic edge glow
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.2);
        
        // Deep obsidian liquid metal body
        vec3 liquidMercury = vec3(0.12, 0.14, 0.18);
        vec3 specularWhite = vec3(0.96, 0.95, 0.92);
        
        // Threat color aura blending
        vec3 activeGlow = mix(liquidMercury, uThreatColor, uThreatLevel * 0.85);
        
        // Internal displacement highlight
        vec3 col = mix(activeGlow, specularWhite, fresnel * 0.85 + vDisplacement * 0.4);
        col += uThreatColor * (fresnel * (0.4 + uAudioFreq * 0.6) * uThreatLevel);

        gl_FragColor = vec4(col, 0.92);
      }
    `;

    const sphereGeometry = new THREE.IcosahedronGeometry(1.6, 64);
    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioFreq: { value: 0.0 },
        uBass: { value: 0.0 },
        uTreble: { value: 0.0 },
        uThreatLevel: { value: 0.0 },
        uThreatColor: { value: new THREE.Color("#A1A1AA") },
        uBaseColor: { value: new THREE.Color("#0E1014") },
      },
      transparent: true,
      wireframe: false,
    });

    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphereMesh);

    // 3. 3D Floating Acoustic Particle Field (1,200 fine orbiting nodes)
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const speedArray = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.4 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      posArray[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      posArray[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      posArray[i * 3 + 2] = radius * Math.cos(phi);
      speedArray[i] = 0.2 + Math.random() * 0.8;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.024,
      color: 0xa1a1aa,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 4. Smooth Mouse Interaction (Parallax Tilt)
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = x;
      mouseY = y;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 5. Audio Analysis Buffer
    const freqData = new Uint8Array(256);
    let smoothedFreq = 0.0;
    let smoothedBass = 0.0;
    let smoothedTreble = 0.0;

    // Target threat colors
    const colorSilver = new THREE.Color("#A1A1AA");
    const colorEmerald = new THREE.Color("#10B981");
    const colorAmber = new THREE.Color("#F59E0B");
    const colorCrimson = new THREE.Color("#FF2E43");

    const currentThreatColor = new THREE.Color("#A1A1AA");
    let currentThreatLevel = 0.0;

    // 6. 60fps Render Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Read Web Audio API AnalyserNode if connected
      const analyser = analyserRef.current;
      let rawFreq = 0;
      let rawBass = 0;
      let rawTreble = 0;

      if (analyser) {
        analyser.getByteFrequencyData(freqData);
        // Bass (bins 0 - 15), Mids (bins 16 - 64), Treble (bins 65 - 180)
        let sumBass = 0;
        let sumTreble = 0;
        let sumAll = 0;

        for (let i = 0; i < 16; i++) sumBass += freqData[i];
        for (let i = 64; i < 180; i++) sumTreble += freqData[i];
        for (let i = 0; i < freqData.length; i++) sumAll += freqData[i];

        rawBass = sumBass / (16 * 255.0);
        rawTreble = sumTreble / (116 * 255.0);
        rawFreq = sumAll / (freqData.length * 255.0);
      }

      // Smooth interpolation for acoustic inputs
      smoothedFreq += (rawFreq - smoothedFreq) * 0.15;
      smoothedBass += (rawBass - smoothedBass) * 0.2;
      smoothedTreble += (rawTreble - smoothedTreble) * 0.25;

      // Update Threat State & Target Color
      let targetColor = colorSilver;
      let targetThreatLevel = 0.0;

      const state = threatRef.current;
      if (state === "VERIFIED_SAFE") {
        targetColor = colorEmerald;
        targetThreatLevel = 0.35;
      } else if (
        state === "SUSPICIOUS_VERIFY" ||
        state === "IMPERSONATION_MIMICRY_WARNING"
      ) {
        targetColor = colorAmber;
        targetThreatLevel = 0.7;
      } else if (state === "CRITICAL_AI_CLONE") {
        targetColor = colorCrimson;
        targetThreatLevel = 1.0;
      } else {
        // STANDBY
        targetColor = colorSilver;
        targetThreatLevel = isLive ? 0.25 : 0.05;
      }

      currentThreatColor.lerp(targetColor, 0.06);
      currentThreatLevel += (targetThreatLevel - currentThreatLevel) * 0.06;

      // Update Shader Uniforms
      sphereMaterial.uniforms.uTime.value = elapsedTime;
      sphereMaterial.uniforms.uAudioFreq.value = smoothedFreq;
      sphereMaterial.uniforms.uBass.value = smoothedBass;
      sphereMaterial.uniforms.uTreble.value = smoothedTreble;
      sphereMaterial.uniforms.uThreatLevel.value = currentThreatLevel;
      sphereMaterial.uniforms.uThreatColor.value.copy(currentThreatColor);

      // Particle Color update
      particleMat.color.copy(currentThreatColor);
      particleMat.opacity = 0.4 + currentThreatLevel * 0.4 + smoothedFreq * 0.3;

      // Smooth Rotation & Mouse Parallax
      targetRotX = mouseY * 0.35;
      targetRotY = mouseX * 0.45;

      sphereMesh.rotation.y += 0.004 + smoothedBass * 0.01;
      sphereMesh.rotation.x += (targetRotX - sphereMesh.rotation.x) * 0.05;
      sphereMesh.rotation.z = Math.sin(elapsedTime * 0.5) * 0.08;

      particles.rotation.y -= 0.002 + smoothedTreble * 0.008;
      particles.rotation.x += (targetRotX * 0.5 - particles.rotation.x) * 0.05;

      // Scale breathing pulse
      const baseScale = docked ? 0.75 : 1.0;
      const pulse = 1.0 + smoothedBass * 0.22 + Math.sin(elapsedTime * 2.0) * 0.015;
      sphereMesh.scale.set(baseScale * pulse, baseScale * pulse, baseScale * pulse);

      renderer.render(scene, camera);
    };

    animate();

    // 7. Resize Observer
    const handleResize = () => {
      if (!mount) return;
      const newW = mount.clientWidth;
      const newH = mount.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      resizeObserver.disconnect();
      mount.removeChild(renderer.domElement);

      sphereGeometry.dispose();
      sphereMaterial.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [docked, isLive]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full min-h-[360px] flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing select-none transition-all duration-700 ${
        docked ? "opacity-90 scale-95" : "opacity-100 scale-100"
      }`}
    >
      {/* Clean minimal audio indicator */}
      <div className="absolute top-4 left-4 font-sans text-xs text-studio-muted pointer-events-none z-10 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-threat-emerald animate-pulse" />
        <span className="text-studio-dim font-medium">Acoustic Signal</span>
      </div>
    </div>
  );
};

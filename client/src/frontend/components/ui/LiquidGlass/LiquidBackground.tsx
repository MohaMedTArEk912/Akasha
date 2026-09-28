/**
 * LiquidBackground — Real-Time Three.js 3D WebGL Code Runtime & Ambient Liquid Canvas
 *
 * Renders the 5 Cybernetic Silicon Processor Wafer Nodes directly into the project background:
 * - Dynamic camera elevation when operations are active so nodes & laser beams rise above cards
 * - Tall vertical hologram laser beams that pierce through the upper horizon
 * - Traveling data packets along bus lines and floating quantum code particles
 * - Responsive to real background tasks and interactive 3D focus mode
 */

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useBackgroundLoading } from "../../../context/BackgroundLoadingContext";

interface NodeStation {
  id: "models" | "apis" | "usecases" | "pages" | "diagram";
  code: string;
  label: string;
  syntaxTag: string;
  colorHex: number;
  colorCss: string;
  x: number;
  z: number;
}

const STATIONS: NodeStation[] = [
  {
    id: "models",
    code: "01",
    label: "DATA SCHEMAS",
    syntaxTag: "type Schema = z.infer<T>",
    colorHex: 0x3b82f6,
    colorCss: "#3b82f6",
    x: -5.4,
    z: 0.1,
  },
  {
    id: "apis",
    code: "02",
    label: "REST & RPC APIS",
    syntaxTag: "app.post('/api/stream')",
    colorHex: 0x06b6d4,
    colorCss: "#06b6d4",
    x: -2.7,
    z: -0.25,
  },
  {
    id: "usecases",
    code: "03",
    label: "ASYNC PIPELINES",
    syntaxTag: "await workflow.dispatch()",
    colorHex: 0x8b5cf6,
    colorCss: "#8b5cf6",
    x: 0.0,
    z: -0.4,
  },
  {
    id: "pages",
    code: "04",
    label: "UI SYNTHESIZER",
    syntaxTag: "<CraftFrame hydrate />",
    colorHex: 0xec4899,
    colorCss: "#ec4899",
    x: 2.7,
    z: -0.25,
  },
  {
    id: "diagram",
    code: "05",
    label: "TOPOLOGY MESH",
    syntaxTag: "cluster.ingress(Mesh)",
    colorHex: 0x10b981,
    colorCss: "#10b981",
    x: 5.4,
    z: 0.1,
  },
];

/**
 * Creates high-resolution procedural circuit board canvas texture for each silicon node
 */
function createChipCanvasTexture(station: NodeStation): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#060913";
    ctx.fillRect(0, 0, size, size);

    // Micro grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // Outer chip border with bevel accents
    ctx.strokeStyle = station.colorCss;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, size - 24, size - 24);

    // Corner brackets
    ctx.lineWidth = 5;
    const bracketSize = 28;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(12, 12 + bracketSize);
    ctx.lineTo(12, 12);
    ctx.lineTo(12 + bracketSize, 12);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(size - 12 - bracketSize, 12);
    ctx.lineTo(size - 12, 12);
    ctx.lineTo(size - 12, 12 + bracketSize);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(12, size - 12 - bracketSize);
    ctx.lineTo(12, size - 12);
    ctx.lineTo(12 + bracketSize, size - 12);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(size - 12 - bracketSize, size - 12);
    ctx.lineTo(size - 12, size - 12);
    ctx.lineTo(size - 12, size - 12 - bracketSize);
    ctx.stroke();

    // Circuit trace paths
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2;
    const traces = [
      [30, 80, 110, 80, 150, 120, 150, 190],
      [size - 30, 80, size - 110, 80, size - 150, 120, size - 150, 190],
      [30, size - 80, 110, size - 80, 150, size - 120, 150, size - 190],
      [size - 30, size - 80, size - 110, size - 80, size - 150, size - 120, size - 150, size - 190],
    ];
    traces.forEach((pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i], pts[i + 1]);
      }
      ctx.stroke();
    });

    // Solder pads
    ctx.fillStyle = station.colorCss;
    [
      [150, 190],
      [size - 150, 190],
      [150, size - 190],
      [size - 150, size - 190],
      [80, 140],
      [size - 80, 140],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Typography
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = station.colorCss;
    ctx.fillText(`CORE ${station.code}`, 32, 54);

    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`// 0x${station.code}F`, size - 120, 52);

    ctx.font = "900 20px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(station.label, 32, size - 64);

    ctx.font = "14px 'Fira Code', 'Courier New', monospace";
    ctx.fillStyle = station.colorCss;
    ctx.fillText(`> ${station.syntaxTag}`, 32, size - 36);

    // Socket guide
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 74, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

export const LiquidBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const { activeTasks, isLoading, is3DFocused } = useBackgroundLoading();

  const activeTasksRef = useRef(activeTasks);
  const isLoadingRef = useRef(isLoading);
  const is3DFocusedRef = useRef(is3DFocused);

  useEffect(() => {
    activeTasksRef.current = activeTasks;
    isLoadingRef.current = isLoading;
    is3DFocusedRef.current = is3DFocused;
  }, [activeTasks, isLoading, is3DFocused]);

  // Three.js Scene Setup & Loop
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a1122, 0.016);

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 6.2, 11.6);
    camera.lookAt(0, 0.4, -0.6);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    const isLowPowerViewport = window.matchMedia("(max-width: 900px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowPowerViewport ? 1 : 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    // Lighting — luminous, light, and aesthetic
    const ambientLight = new THREE.AmbientLight(0xe0f2fe, 1.25);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.75);
    dirLight.position.set(4, 14, 8);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.3);
    rimLight.position.set(-6, 8, -6);
    scene.add(rimLight);

    // Motherboard Ground Surface — light & translucent
    const groundGeo = new THREE.PlaneGeometry(36, 18);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1730,
      roughness: 0.65,
      metalness: 0.4,
      transparent: true,
      opacity: 0.32,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // Motherboard Blueprint Grid — glowing light cybernetic lines
    const gridHelper = new THREE.GridHelper(36, 36, 0x38bdf8, 0x1e3a5f);
    gridHelper.position.y = 0.01;
    const gridMaterials = Array.isArray(gridHelper.material)
      ? gridHelper.material
      : [gridHelper.material];
    gridMaterials.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.24;
    });
    scene.add(gridHelper);

    // Laser Data Bus Lines
    const busLineGeo = new THREE.BufferGeometry();
    const busPoints: number[] = [];
    for (let i = 0; i < STATIONS.length - 1; i++) {
      const s1 = STATIONS[i];
      const s2 = STATIONS[i + 1];
      busPoints.push(s1.x, 0.02, s1.z);
      busPoints.push(s2.x, 0.02, s2.z);
    }
    busLineGeo.setAttribute("position", new THREE.Float32BufferAttribute(busPoints, 3));
    const busLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      linewidth: 2,
    });
    const busLines = new THREE.LineSegments(busLineGeo, busLineMat);
    scene.add(busLines);

    // Traveling Data Packet Mesh
    const packetGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const packetMesh = new THREE.Mesh(packetGeo, packetMat);
    scene.add(packetMesh);

    // Build the 5 Silicon Processor Wafer Nodes
    interface ChipRefs {
      coreDieInner: THREE.Mesh;
      coreDieOuter: THREE.Mesh;
      laserRing: THREE.Mesh;
      laserBeam: THREE.Mesh;
      pointLight: THREE.PointLight;
      station: NodeStation;
    }
    const chipRefs: ChipRefs[] = [];

    STATIONS.forEach((station) => {
      const group = new THREE.Group();
      group.position.set(station.x, 0, station.z);

      // Ceramic Chip Base
      const chipBaseGeo = new THREE.BoxGeometry(2.1, 0.22, 2.1);
      const chipBaseMat = new THREE.MeshStandardMaterial({
        color: 0x111622,
        roughness: 0.3,
        metalness: 0.8,
      });
      const chipBase = new THREE.Mesh(chipBaseGeo, chipBaseMat);
      chipBase.position.y = 0.11;
      group.add(chipBase);

      // Gold Pins around perimeter
      const pinGeo = new THREE.BoxGeometry(0.05, 0.08, 0.16);
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.95,
        roughness: 0.15,
      });
      const pinCount = 7;
      const spacing = 1.6 / (pinCount - 1);
      for (let i = 0; i < pinCount; i++) {
        const offset = -0.8 + i * spacing;
        const pN = new THREE.Mesh(pinGeo, pinMat);
        pN.position.set(offset, 0.05, -1.08);
        group.add(pN);

        const pS = new THREE.Mesh(pinGeo, pinMat);
        pS.position.set(offset, 0.05, 1.08);
        group.add(pS);

        const pE = new THREE.Mesh(pinGeo, pinMat);
        pE.rotation.y = Math.PI / 2;
        pE.position.set(1.08, 0.05, offset);
        group.add(pE);

        const pW = new THREE.Mesh(pinGeo, pinMat);
        pW.rotation.y = Math.PI / 2;
        pW.position.set(-1.08, 0.05, offset);
        group.add(pW);
      }

      // Top Silicon Wafer with Canvas Texture
      const texture = createChipCanvasTexture(station);
      const topPlateGeo = new THREE.PlaneGeometry(1.95, 1.95);
      const topPlateMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.2,
        metalness: 0.4,
      });
      const topPlate = new THREE.Mesh(topPlateGeo, topPlateMat);
      topPlate.rotation.x = -Math.PI / 2;
      topPlate.position.y = 0.225;
      group.add(topPlate);

      // Central Quantum Die (Inner polyhedron)
      const coreDieGeo = new THREE.OctahedronGeometry(0.34, 0);
      const coreDieMat = new THREE.MeshStandardMaterial({
        color: station.colorHex,
        emissive: station.colorHex,
        emissiveIntensity: 0.9,
        roughness: 0.1,
        metalness: 0.2,
      });
      const coreDieInner = new THREE.Mesh(coreDieGeo, coreDieMat);
      coreDieInner.position.y = 0.48;
      group.add(coreDieInner);

      // Outer wireframe cage
      const cageGeo = new THREE.OctahedronGeometry(0.44, 0);
      const cageMat = new THREE.MeshBasicMaterial({
        color: station.colorHex,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
      });
      const coreDieOuter = new THREE.Mesh(cageGeo, cageMat);
      coreDieOuter.position.y = 0.48;
      group.add(coreDieOuter);

      // Circular Laser Progress Ring
      const ringGeo = new THREE.TorusGeometry(0.68, 0.035, 12, 48);
      const ringMat = new THREE.MeshStandardMaterial({
        color: station.colorHex,
        emissive: station.colorHex,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      });
      const laserRing = new THREE.Mesh(ringGeo, ringMat);
      laserRing.rotation.x = Math.PI / 2;
      laserRing.position.y = 0.24;
      group.add(laserRing);

      // High-Rising Laser Hologram Beam (Shoots high into the sky above cards!)
      const beamGeo = new THREE.CylinderGeometry(0.18, 0.55, 7.5, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: station.colorHex,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const laserBeam = new THREE.Mesh(beamGeo, beamMat);
      laserBeam.position.y = 3.8;
      group.add(laserBeam);

      // Local Point Light
      const pointLight = new THREE.PointLight(station.colorHex, 0.6, 5.0);
      pointLight.position.set(0, 0.8, 0);
      group.add(pointLight);

      scene.add(group);

      chipRefs.push({
        coreDieInner,
        coreDieOuter,
        laserRing,
        laserBeam,
        pointLight,
        station,
      });
    });

    // Floating Quantum Particle Swarm
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 18;
      particlePositions[i + 1] = 0.2 + Math.random() * 4.5;
      particlePositions[i + 2] = (Math.random() - 0.5) * 8;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.08,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();
    const targetCameraPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();
    const currentLookAt = new THREE.Vector3(0, 0, -0.6);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameInterval = prefersReducedMotion || isLowPowerViewport ? 1000 / 30 : 1000 / 45;
    let lastFrameTime = 0;
    const animate = (now = performance.now()) => {
      animationFrameId = requestAnimationFrame(animate);
      if (now - lastFrameTime < frameInterval || document.hidden) return;
      lastFrameTime = now;
      const elapsed = (performance.now() - startTime) * 0.001;

      // Traveling data packet
      const t = (elapsed * 0.35) % 1;
      const totalStations = STATIONS.length;
      const currIdx = Math.floor(t * (totalStations - 1));
      const nextIdx = Math.min(currIdx + 1, totalStations - 1);
      const segmentT = (t * (totalStations - 1)) - currIdx;
      const s1 = STATIONS[currIdx];
      const s2 = STATIONS[nextIdx];
      packetMesh.position.x = s1.x + (s2.x - s1.x) * segmentT;
      packetMesh.position.z = s1.z + (s2.z - s1.z) * segmentT;
      packetMesh.position.y = 0.1 + Math.sin(segmentT * Math.PI) * 0.18;

      // Floating Particles
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 1; i < particleCount * 3; i += 3) {
        posAttr.array[i] += Math.sin(elapsed + i) * 0.0035;
        if (posAttr.array[i] > 5.0) posAttr.array[i] = 0.4;
      }
      posAttr.needsUpdate = true;

      // Animate each Chip Node
      chipRefs.forEach(({ coreDieInner, coreDieOuter, laserRing, laserBeam, pointLight, station }) => {
        const currentTasks = activeTasksRef.current;
        const working = isLoadingRef.current || currentTasks.length > 0;
        const focused = is3DFocusedRef.current;
        const activeTask = currentTasks.find((t) => t.id.toLowerCase().includes(station.id));
        const isStationActive = working && (activeTask?.status === "loading" || currentTasks.length === 0);

        const spinSpeed = isStationActive ? 0.055 : focused ? 0.025 : 0.012;
        coreDieInner.rotation.y += spinSpeed;
        coreDieInner.rotation.x = Math.sin(elapsed * 2) * 0.2;
        coreDieOuter.rotation.y -= spinSpeed * 0.85;
        coreDieOuter.rotation.z = Math.cos(elapsed * 1.5) * 0.15;

        // Floating bounce
        coreDieInner.position.y = 0.48 + Math.sin(elapsed * 2.5 + station.x) * 0.04;
        coreDieOuter.position.y = coreDieInner.position.y;

        // Laser beam & progress ring animation
        if (isStationActive) {
          (laserBeam.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(elapsed * 8) * 0.25;
          laserRing.rotation.z += 0.04;
          laserRing.scale.setScalar(1.0 + Math.sin(elapsed * 6) * 0.06);
          (laserRing.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(elapsed * 6) * 0.8;
          pointLight.intensity = 1.6 + Math.sin(elapsed * 8) * 0.6;
        } else if (working) {
          (laserBeam.material as THREE.MeshBasicMaterial).opacity = 0.2;
          laserRing.rotation.z += 0.01;
          (laserRing.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8;
          pointLight.intensity = 0.8;
        } else {
          (laserBeam.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(elapsed * 1.5 + station.x) * 0.04;
          laserRing.rotation.z += 0.006;
          (laserRing.material as THREE.MeshStandardMaterial).emissiveIntensity = focused ? 1.0 : 0.65;
          pointLight.intensity = focused ? 1.2 : 0.8;
        }
      });

      // Adaptive Dynamic Camera Elevation & Framing:
      // When WORKING: elevate camera high and tilt so nodes rise above/around the cards!
      // When 3D FOCUSED: zoom in closer for full inspection!
      // When IDLE: clean elevated ambient resting angle where nodes & lasers remain seen.
      if (is3DFocusedRef.current) {
        targetCameraPos.set(mouseX * 1.5, 6.2 - mouseY * 0.8, 8.8);
        targetLookAt.set(0, 0.4, -0.6);
      } else if (isLoadingRef.current || activeTasksRef.current.length > 0) {
        // High elevation perspective: nodes & lasers are visible above the cards!
        targetCameraPos.set(mouseX * 1.0, 9.4 - mouseY * 0.6, 10.8);
        targetLookAt.set(0, 1.4, -0.8);
      } else {
        targetCameraPos.set(mouseX * 0.6, 6.2 - mouseY * 0.4, 11.6);
        targetLookAt.set(0, 0.4, -0.6);
      }

      camera.position.lerp(targetCameraPos, 0.045);
      currentLookAt.lerp(targetLookAt, 0.045);
      camera.lookAt(currentLookAt);

      renderer.render(scene, camera);
    };
    animate();

    // Window Resize Handler
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      scene.clear();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="liquid-ambient-canvas" aria-hidden="true">
      {/* 3D WebGL Code Runtime Canvas */}
      <div ref={mountRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Aurora orbs */}
      <div className="liquid-aurora-orb liquid-orb-1" />
      <div className="liquid-aurora-orb liquid-orb-2" />
      <div className="liquid-aurora-orb liquid-orb-3" />
      <div className="liquid-aurora-orb liquid-orb-4" />
      <div className="liquid-aurora-orb liquid-orb-5" />

      {/* Radiant Beams */}
      <div className="motion-beam motion-beam-1" />
      <div className="motion-beam motion-beam-2" />

      {/* Tactile textures */}
      <div className="liquid-texture-grid" />
      <div className="liquid-texture-dots" />
      <div className="liquid-texture-vignette" />
      <div className="liquid-texture-sheen" />
    </div>
  );
};

export default LiquidBackground;

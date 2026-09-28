/**
 * CodeRuntimeConsole — 3D Three.js WebGL Parallel Code Compiler & Runtime Telemetry
 *
 * Replaces analog horological chronometers with a futuristic Cybernetic Microchip &
 * Quantum Build Pipeline node engine directly integrated into the page UI.
 *
 * Features:
 * - 5 3D Silicon Processor Wafer Nodes (Schemas, APIs, Workflows, UI Synthesizer, Topology Mesh)
 * - Procedural circuit trace textures, live syntax tokens, and hex register typography
 * - Rotating crystalline quantum dies, circular laser compile progress arcs, and vertical hologram beams
 * - Laser data bus transmission lines connecting parallel nodes
 * - Smooth camera easing into individual processor nodes upon click
 * - Integrated page placement (no detached bottom footer) with Expand / Collapse HUD modes
 * - Automatic expansion and focus when background tasks/compilation active
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { useBackgroundLoading } from "../../../context/BackgroundLoadingContext";

export interface NodeStation {
  id: "models" | "apis" | "usecases" | "pages" | "diagram";
  code: string;
  label: string;
  sublabel: string;
  syntaxTag: string;
  colorHex: number;
  colorCss: string;
  x: number;
  z: number;
}

export const STATIONS: NodeStation[] = [
  {
    id: "models",
    code: "01",
    label: "DATA SCHEMAS",
    sublabel: "TypeGen & Prisma AST",
    syntaxTag: "type Schema = z.infer<T>",
    colorHex: 0x3b82f6,
    colorCss: "#3b82f6",
    x: -5.4,
    z: 0.2,
  },
  {
    id: "apis",
    code: "02",
    label: "REST & RPC APIS",
    sublabel: "Endpoints & Auth Routes",
    syntaxTag: "app.post('/api/stream')",
    colorHex: 0x06b6d4,
    colorCss: "#06b6d4",
    x: -2.7,
    z: -0.15,
  },
  {
    id: "usecases",
    code: "03",
    label: "ASYNC PIPELINES",
    sublabel: "Temporal Jobs & Queues",
    syntaxTag: "await workflow.dispatch()",
    colorHex: 0x8b5cf6,
    colorCss: "#8b5cf6",
    x: 0.0,
    z: -0.3,
  },
  {
    id: "pages",
    code: "04",
    label: "UI SYNTHESIZER",
    sublabel: "React DOM & Craft AST",
    syntaxTag: "<CraftFrame hydrate />",
    colorHex: 0xec4899,
    colorCss: "#ec4899",
    x: 2.7,
    z: -0.15,
  },
  {
    id: "diagram",
    code: "05",
    label: "TOPOLOGY MESH",
    sublabel: "Kubernetes & Edge Ingress",
    syntaxTag: "cluster.ingress(ServiceMesh)",
    colorHex: 0x10b981,
    colorCss: "#10b981",
    x: 5.4,
    z: 0.2,
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
    // Dark ceramic silicon background
    ctx.fillStyle = "#070a14";
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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    // Diagonal bus routes
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
      [80, size - 140],
      [size - 80, size - 140],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Typography
    // Node Code & Header
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = station.colorCss;
    ctx.fillText(`CORE ${station.code}`, 32, 54);

    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`// RUNTIME_ID: 0x${station.code}AF4`, size - 210, 52);

    // Station Name
    ctx.font = "900 20px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(station.label, 32, size - 64);

    // Syntax code snippet
    ctx.font = "14px 'Fira Code', 'Courier New', monospace";
    ctx.fillStyle = station.colorCss;
    ctx.fillText(`> ${station.syntaxTag}`, 32, size - 36);

    // Center circular socket guide
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 74, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

export interface CodeRuntimeConsoleProps {
  className?: string;
  defaultExpanded?: boolean;
}

export const CodeRuntimeConsole: React.FC<CodeRuntimeConsoleProps> = ({
  className = "",
  defaultExpanded = true,
}) => {
  const { activeTasks, isLoading } = useBackgroundLoading();
  const consoleRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [focusedStationId, setFocusedStationId] = useState<string | null>(null);

  // Local simulated test states for interactive demonstration
  const [simulatedTasks, setSimulatedTasks] = useState<Record<string, { progress: number; step: string }>>({});

  // Merge real active tasks with simulated tasks
  const stationAssignments = useMemo(() => {
    const map = new Map<string, { progress: number; step: string; status: "idle" | "loading" | "done" }>();

    STATIONS.forEach((st) => {
      // Check real active tasks
      const realTask = activeTasks.find((t) => t.id.toLowerCase().includes(st.id));
      if (realTask) {
        map.set(st.id, {
          progress: realTask.progress || 20,
          step: realTask.step || "Processing...",
          status: realTask.status === "loading" ? "loading" : realTask.status === "done" ? "done" : "idle",
        });
        return;
      }

      // Check simulated test tasks
      const sim = simulatedTasks[st.id];
      if (sim) {
        map.set(st.id, {
          progress: sim.progress,
          step: sim.step,
          status: sim.progress >= 100 ? "done" : "loading",
        });
        return;
      }

      map.set(st.id, {
        progress: 0,
        step: st.sublabel,
        status: "idle",
      });
    });

    return map;
  }, [activeTasks, simulatedTasks]);

  // Overall active flag
  const isAnyActive = useMemo(() => {
    if (isLoading || activeTasks.length > 0) return true;
    return Object.values(simulatedTasks).some((s) => s.progress > 0 && s.progress < 100);
  }, [isLoading, activeTasks, simulatedTasks]);

  // Auto-expand when operations start
  useEffect(() => {
    if (isAnyActive && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isAnyActive, isExpanded]);

  // Simulation runner for live test demonstration
  const runSimulation = useCallback(() => {
    const steps = [
      { id: "models", label: "AST Schema Generation", delay: 0 },
      { id: "apis", label: "REST Endpoint Compilation", delay: 600 },
      { id: "usecases", label: "Temporal Workflow Orchestration", delay: 1200 },
      { id: "pages", label: "React Craft AST Synthesis", delay: 1800 },
      { id: "diagram", label: "Edge Cluster Mesh Provision", delay: 2400 },
    ];

    steps.forEach(({ id, label, delay }) => {
      setTimeout(() => {
        let p = 0;
        const interval = setInterval(() => {
          p += 12;
          if (p >= 100) {
            p = 100;
            clearInterval(interval);
            setSimulatedTasks((prev) => ({
              ...prev,
              [id]: { progress: 100, step: "Ready • Compiled" },
            }));
          } else {
            setSimulatedTasks((prev) => ({
              ...prev,
              [id]: { progress: p, step: `${label} (${p}%)` },
            }));
          }
        }, 120);
      }, delay);
    });
  }, []);

  // Three.js WebGL Scene Initialization & Lifecycle
  useEffect(() => {
    if (!isExpanded) return;
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 280;

    // Scene & Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060912, 0.045);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 7.8, 11.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 1.8);
    dirLight.position.set(4, 12, 8);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(-6, 8, -6);
    scene.add(rimLight);

    // Motherboard Ground Surface
    const groundGeo = new THREE.PlaneGeometry(28, 12);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x060810,
      roughness: 0.85,
      metalness: 0.4,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // Procedural Circuit Motherboard Grid Lines
    const gridHelper = new THREE.GridHelper(26, 26, 0x1e293b, 0x0f172a);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Laser Data Bus Lines connecting the stations
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
      opacity: 0.35,
      linewidth: 2,
    });
    const busLines = new THREE.LineSegments(busLineGeo, busLineMat);
    scene.add(busLines);

    // Traveling Data Packets along the bus lines
    const packetGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const packetMesh = new THREE.Mesh(packetGeo, packetMat);
    scene.add(packetMesh);

    // Node Chip Meshes Storage for Animation Loop
    interface ChipRefs {
      group: THREE.Group;
      coreDieInner: THREE.Mesh;
      coreDieOuter: THREE.Mesh;
      laserRing: THREE.Mesh;
      laserBeam: THREE.Mesh;
      pointLight: THREE.PointLight;
      station: NodeStation;
    }
    const chipRefs: ChipRefs[] = [];

    // Build the 5 Silicon Processor Nodes
    STATIONS.forEach((station) => {
      const group = new THREE.Group();
      group.position.set(station.x, 0, station.z);

      // 1. Ceramic Chip Base
      const chipBaseGeo = new THREE.BoxGeometry(2.1, 0.22, 2.1);
      const chipBaseMat = new THREE.MeshStandardMaterial({
        color: 0x121722,
        roughness: 0.3,
        metalness: 0.8,
      });
      const chipBase = new THREE.Mesh(chipBaseGeo, chipBaseMat);
      chipBase.position.y = 0.11;
      group.add(chipBase);

      // 2. Gold Contact Bus Pins around the perimeter
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
        // North pins
        const pN = new THREE.Mesh(pinGeo, pinMat);
        pN.position.set(offset, 0.05, -1.08);
        group.add(pN);
        // South pins
        const pS = new THREE.Mesh(pinGeo, pinMat);
        pS.position.set(offset, 0.05, 1.08);
        group.add(pS);
        // East pins
        const pE = new THREE.Mesh(pinGeo, pinMat);
        pE.rotation.y = Math.PI / 2;
        pE.position.set(1.08, 0.05, offset);
        group.add(pE);
        // West pins
        const pW = new THREE.Mesh(pinGeo, pinMat);
        pW.rotation.y = Math.PI / 2;
        pW.position.set(-1.08, 0.05, offset);
        group.add(pW);
      }

      // 3. Top Silicon Wafer with Procedural Canvas Texture
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

      // 4. Central Quantum Processor Die
      // Inner glowing polyhedron
      const coreDieGeo = new THREE.OctahedronGeometry(0.32, 0);
      const coreDieMat = new THREE.MeshStandardMaterial({
        color: station.colorHex,
        emissive: station.colorHex,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.2,
      });
      const coreDieInner = new THREE.Mesh(coreDieGeo, coreDieMat);
      coreDieInner.position.y = 0.45;
      group.add(coreDieInner);

      // Outer wireframe cage
      const cageGeo = new THREE.OctahedronGeometry(0.42, 0);
      const cageMat = new THREE.MeshBasicMaterial({
        color: station.colorHex,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      });
      const coreDieOuter = new THREE.Mesh(cageGeo, cageMat);
      coreDieOuter.position.y = 0.45;
      group.add(coreDieOuter);

      // 5. Circular Laser Loading / Compile Progress Ring
      const ringGeo = new THREE.TorusGeometry(0.68, 0.035, 12, 48);
      const ringMat = new THREE.MeshStandardMaterial({
        color: station.colorHex,
        emissive: station.colorHex,
        emissiveIntensity: 0.4,
        roughness: 0.2,
      });
      const laserRing = new THREE.Mesh(ringGeo, ringMat);
      laserRing.rotation.x = Math.PI / 2;
      laserRing.position.y = 0.24;
      group.add(laserRing);

      // 6. Vertical Laser Hologram Beam (shoots up when compiling)
      const beamGeo = new THREE.CylinderGeometry(0.18, 0.42, 2.6, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: station.colorHex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const laserBeam = new THREE.Mesh(beamGeo, beamMat);
      laserBeam.position.y = 1.5;
      group.add(laserBeam);

      // 7. Localized Point Light
      const pointLight = new THREE.PointLight(station.colorHex, 0.5, 3.5);
      pointLight.position.set(0, 0.7, 0);
      group.add(pointLight);

      scene.add(group);

      chipRefs.push({
        group,
        coreDieInner,
        coreDieOuter,
        laserRing,
        laserBeam,
        pointLight,
        station,
      });
    });

    // 8. Floating Quantum Code Particle Swarm
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 16;
      particlePositions[i + 1] = 0.2 + Math.random() * 2.8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.065,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // Mouse Interaction
    const mouse = new THREE.Vector2(-999, -999);
    let targetCameraPos = new THREE.Vector3(0, 7.8, 11.2);
    let targetLookAt = new THREE.Vector3(0, 0, 0);
    const currentLookAt = new THREE.Vector3(0, 0, 0);

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    container.addEventListener("pointermove", onPointerMove);

    // Render Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Animate packet along bus line
      const t = (elapsed * 0.4) % 1;
      const totalStations = STATIONS.length;
      const currIdx = Math.floor(t * (totalStations - 1));
      const nextIdx = Math.min(currIdx + 1, totalStations - 1);
      const segmentT = (t * (totalStations - 1)) - currIdx;
      const s1 = STATIONS[currIdx];
      const s2 = STATIONS[nextIdx];
      packetMesh.position.x = s1.x + (s2.x - s1.x) * segmentT;
      packetMesh.position.z = s1.z + (s2.z - s1.z) * segmentT;
      packetMesh.position.y = 0.08 + Math.sin(segmentT * Math.PI) * 0.12;

      // Animate Floating Particles
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 1; i < particleCount * 3; i += 3) {
        posAttr.array[i] += Math.sin(elapsed + i) * 0.003;
        if (posAttr.array[i] > 3.2) posAttr.array[i] = 0.3;
      }
      posAttr.needsUpdate = true;

      // Animate each Chip Node
      chipRefs.forEach(({ coreDieInner, coreDieOuter, laserRing, laserBeam, pointLight, station }) => {
        const state = stationAssignments.get(station.id);
        const isActive = state?.status === "loading";
        const isDone = state?.status === "done";
        const isFocused = focusedStationId === station.id;

        // Core die spin velocity
        const speed = isActive ? 0.055 : isFocused ? 0.025 : 0.01;
        coreDieInner.rotation.y += speed;
        coreDieInner.rotation.x = Math.sin(elapsed * 2) * 0.2;
        coreDieOuter.rotation.y -= speed * 0.8;
        coreDieOuter.rotation.z = Math.cos(elapsed * 1.5) * 0.15;

        // Floating bounce
        coreDieInner.position.y = 0.45 + Math.sin(elapsed * 2.5 + station.x) * 0.04;
        coreDieOuter.position.y = coreDieInner.position.y;

        // Laser beam & progress ring animation
        if (isActive) {
          const progressRatio = Math.max(0.2, (state?.progress || 30) / 100);
          (laserBeam.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(elapsed * 8) * 0.2;
          laserBeam.scale.y = progressRatio;
          laserRing.rotation.z += 0.04;
          laserRing.scale.setScalar(1.0 + Math.sin(elapsed * 6) * 0.05);
          (laserRing.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(elapsed * 6) * 0.8;
          pointLight.intensity = 1.4 + Math.sin(elapsed * 8) * 0.6;
        } else if (isDone) {
          (laserBeam.material as THREE.MeshBasicMaterial).opacity = 0.08;
          laserRing.rotation.z += 0.005;
          (laserRing.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
          pointLight.intensity = 0.7;
        } else {
          (laserBeam.material as THREE.MeshBasicMaterial).opacity = 0.0;
          laserRing.rotation.z += 0.003;
          (laserRing.material as THREE.MeshStandardMaterial).emissiveIntensity = isFocused ? 0.8 : 0.3;
          pointLight.intensity = isFocused ? 1.0 : 0.4;
        }
      });

      // Camera Easing (Lerp)
      if (focusedStationId) {
        const found = STATIONS.find((s) => s.id === focusedStationId);
        if (found) {
          targetCameraPos.set(found.x, 3.2, found.z + 4.8);
          targetLookAt.set(found.x, 0.4, found.z);
        }
      } else {
        // Overview mode with subtle mouse parallax
        const parallaxX = mouse.x * 0.8;
        const parallaxY = mouse.y * 0.4;
        targetCameraPos.set(parallaxX, 7.8 - parallaxY, 11.2);
        targetLookAt.set(0, 0, 0);
      }

      camera.position.lerp(targetCameraPos, 0.06);
      currentLookAt.lerp(targetLookAt, 0.06);
      camera.lookAt(currentLookAt);

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isExpanded, focusedStationId, stationAssignments]);

  return (
    <div
      ref={consoleRef}
      id="code-runtime-console"
      className={`relative w-full rounded-3xl backdrop-blur-2xl transition-all duration-300 select-none overflow-hidden ${
        isExpanded
          ? "p-4 sm:p-5 bg-white/[0.85] dark:bg-[#07090e]/90 border border-black/[0.08] dark:border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)]"
          : "p-2.5 sm:p-3 bg-white/[0.7] dark:bg-[#07090e]/70 border border-black/[0.06] dark:border-white/10 shadow-md"
      } ${className}`}
    >
      {/* ===== RUNTIME CONSOLE TOP STATUS BAR ===== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/10">
        <div className="flex items-center gap-3">
          {/* Status Indicator Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/10">
            <span
              className={`w-2 h-2 rounded-full ${
                isAnyActive ? "bg-cyan-500 animate-ping" : "bg-emerald-500"
              }`}
            />
            <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-800 dark:text-neutral-200 uppercase">
              {isAnyActive ? "COMPILER ACTIVE" : "RUNTIME READY"}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black tracking-widest uppercase text-neutral-950 dark:text-white">
                Parallel Code Runtime
              </h3>
              <span className="text-[9px] font-mono font-bold text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/10">
                5 WAFER NODES
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Hardware-accelerated Three.js WebGL compiler telemetry • Real-time AST & route synthesis
            </p>
          </div>
        </div>

        {/* Console Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Demo trigger to test loading animations */}
          <button
            type="button"
            onClick={runSimulation}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 transition-all cursor-pointer flex items-center gap-1"
            title="Trigger test parallel code compilation across all 5 nodes"
          >
            <span>Simulate Pipeline</span>
          </button>

          {isExpanded && focusedStationId && (
            <button
              type="button"
              onClick={() => setFocusedStationId(null)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              Reset View ⟲
            </button>
          )}

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer flex items-center gap-1"
          >
            {isExpanded ? "Collapse ▾" : "Expand 3D Core ▸"}
          </button>
        </div>
      </div>

      {/* ===== EXPANDED 3D WEBGL COMPILER STAGE ===== */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Three.js 3D Viewport */}
          <div className="relative w-full h-[240px] sm:h-[280px] rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/10 shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)] bg-[#05070d]">
            <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Edge Vignette */}
            <div className="pointer-events-none absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/70" />

            {/* Hint overlay */}
            <div className="pointer-events-none absolute bottom-2.5 left-3 text-[10px] font-mono text-neutral-500">
              Interactive 3D • Click any node below to inspect compiler core
            </div>
          </div>

          {/* 5 Station Telemetry Dock Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {STATIONS.map((station) => {
              const state = stationAssignments.get(station.id);
              const isActive = state?.status === "loading";
              const isDone = state?.status === "done";
              const isFocused = focusedStationId === station.id;

              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() =>
                    setFocusedStationId(focusedStationId === station.id ? null : station.id)
                  }
                  className={`
                    text-left p-3 rounded-xl transition-all duration-200 cursor-pointer
                    border backdrop-blur-md
                    ${
                      isActive
                        ? "bg-blue-500/15 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.25)] scale-[1.02]"
                        : isDone
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : isFocused
                        ? "bg-white/20 dark:bg-white/15 border-blue-400/50 scale-[1.02]"
                        : "bg-white/60 dark:bg-white/[0.04] border-black/[0.06] dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/[0.08]"
                    }
                  `}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-mono font-bold" style={{ color: station.colorCss }}>
                      NODE {station.code}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full uppercase font-bold ${
                        isActive
                          ? "bg-blue-500/20 text-blue-500 animate-pulse"
                          : isDone
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-neutral-500/10 text-neutral-500"
                      }`}
                    >
                      {isActive ? `${Math.round(state?.progress || 0)}%` : isDone ? "READY" : "IDLE"}
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-neutral-900 dark:text-white truncate">
                    {station.label}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {isActive ? state?.step : station.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeRuntimeConsole;

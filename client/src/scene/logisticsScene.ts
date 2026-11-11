import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Diorama logístico em WebGL montado pela rolagem.
 * Progresso 0 → 1 = linha do tempo: estrada, caminhão, armazém, pátio,
 * cidade, viaduto, rota e entrega final entram em cena em sequência.
 */

export type LogisticsSceneHandle = {
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  setOrbit: (active: boolean) => void;
  setSegmentView: (kind: string | null) => void;
  setFeatureScreen: (index: number) => void;
  setSegmentZoom: (z: number) => void;
  orbitBy: (delta: number) => void;
  orbitZoom: (delta: number) => void;
  resize: () => void;
  dispose: () => void;
};

const BRAND = 0x8fe04a;
const BRAND_DEEP = 0x63b32e;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round = (w: number, h: number, d: number, radius = 0.18, segments = 2) =>
  new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, Math.min(w, h, d) / 2.05));

type CamKey = { t: number; pos: [number, number, number]; look: [number, number, number] };

const CAMERA_KEYS: CamKey[] = [
  { t: 0.0, pos: [38, 17, 42], look: [-20, 3, 2] },
  { t: 0.1, pos: [30, 16, 34], look: [-16, 4, -8] },
  { t: 0.2, pos: [14, 15, 22], look: [-14, 5, -14] },
  { t: 0.3, pos: [42, 20, 24], look: [12, 5, -10] },
  { t: 0.4, pos: [32, 19, 18], look: [6, 4, -30] },
  { t: 0.5, pos: [20, 24, 22], look: [0, 4, -70] },
  { t: 0.6, pos: [10, 24, 24], look: [0, 3, -50] },
  { t: 0.7, pos: [6, 26, 34], look: [0, 2, -60] },
  { t: 0.8, pos: [6, 32, 8], look: [50, 8, -50] },
  { t: 0.9, pos: [32, 26, -8], look: [52, 9, -54] },
  { t: 1.0, pos: [34, 21, -32], look: [58, 13, -58] },
];

const ROUTE_POINTS: [number, number, number][] = [
  [0, 0.32, 12],
  [-1.2, 0.32, -2],
  [1.2, 0.32, -20],
  [-1.2, 0.32, -40],
  [4, 0.32, -48],
  [34, 0.32, -47],
  [57, 0.32, -44],
];

function makeShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.9)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.38)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFeatureScreen(kind: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b1611";
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "rgba(143,224,74,0.16)";
  ctx.fillRect(0, 0, 640, 52);
  ctx.fillStyle = "#8fe04a";
  ctx.font = "600 18px Inter, sans-serif";
  ctx.fillText(
    ["SIMULAÇÃO DE FRETE · SP → CURITIBA", "OCORRÊNCIAS · PEDIDO #4821", "AFERIÇÃO DA FATURA · OUTUBRO", "DESEMPENHO · ÚLTIMOS 30 DIAS"][kind],
    20,
    34,
  );
  ctx.fillStyle = "#f2ffe2";
  ctx.font = "700 34px Sora, Inter, sans-serif";
  ctx.fillText(
    ["Comparativo de transportadoras", "Linha do tempo da carga", "Conferência CTe × tabela", "Indicadores da operação"][kind],
    20,
    104,
  );
  const tables = [
    [
      ["Transportadora A", "2 dias", "R$ 1.248,00", ""],
      ["Transportadora B", "3 dias", "R$ 1.096,50", "✓"],
      ["Transportadora C", "4 dias", "R$ 1.182,30", ""],
    ],
    [
      ["Coleta realizada", "08:40", "ok", "✓"],
      ["Em trânsito · BR-116", "12:15", "ok", "✓"],
      ["Atraso previsto", "40 min", "tratado", "✓"],
      ["Chegada no CD", "prevista", "", ""],
    ],
    [
      ["CTe 3321", "tabela", "R$ 1.096,50", "✓"],
      ["CTe 3322", "tabela", "R$ 840,00", "✓"],
      ["CTe 3323", "divergência", "R$ 1.310,20", ""],
    ],
    [
      ["No prazo", "96,2%", "meta 95%", "✓"],
      ["Conta frete", "-11,4%", "vs. mês", "✓"],
      ["Ocorrências", "0,8%", "vs. 1,4%", "✓"],
    ],
  ];
  const rows = tables[kind] ?? tables[0];
  rows.forEach((row, i) => {
    const y = 132 + i * 52;
    const best = row[3] === "✓";
    ctx.fillStyle = best ? "rgba(143,224,74,0.18)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(20, y, 600, 44);
    if (best) {
      ctx.strokeStyle = "#8fe04a";
      ctx.lineWidth = 2;
      ctx.strokeRect(20, y, 600, 44);
    }
    ctx.fillStyle = "#e8f4dc";
    ctx.font = "500 20px Inter, sans-serif";
    ctx.fillText(row[0], 36, y + 29);
    ctx.fillStyle = "rgba(232,244,220,0.6)";
    ctx.fillText(row[1], 360, y + 29);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Inter, sans-serif";
    ctx.fillText(row[2], 450, y + 29);
    if (best) {
      ctx.fillStyle = "#8fe04a";
      ctx.beginPath();
      ctx.arc(596, y + 22, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b1611";
      ctx.font = "700 18px Inter, sans-serif";
      ctx.fillText("✓", 590, y + 28);
    }
  });
  ctx.fillStyle = "#8fe04a";
  ctx.fillRect(20, 340, 600, 44);
  ctx.fillStyle = "#0b1611";
  ctx.font = "700 20px Inter, sans-serif";
  ctx.fillText(["Cotação aprovada · pedido #4821 gerado", "Cliente notificado · ocorrência tratada", "Diferença encontrada: R$ 84,20", "Exportar relatório · PDF / XLSX"][kind], 36, 369);
  return canvas;
}

function makeScreenTexture(kind: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 200;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b1611";
  ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = "rgba(143,224,74,0.14)";
  ctx.fillRect(0, 0, 320, 26);
  ctx.fillStyle = "#8fe04a";
  ctx.font = "600 13px Inter, sans-serif";
  ctx.fillText(["FRETES · DIA", "CONTA FRETE", "TRACKING"][kind], 12, 18);
  ctx.fillStyle = "#f2ffe2";
  ctx.font = "700 30px Sora, Inter, sans-serif";
  ctx.fillText(["412", "R$ 1,24 mi", "98,4%"][kind], 12, 58);
  ctx.fillStyle = "rgba(143,224,74,0.8)";
  ctx.font = "600 11px Inter, sans-serif";
  ctx.fillText(["no prazo", "-7,8% no mês", "no prazo"][kind], 118, 56);

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  for (let i = 1; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(12, 78 + i * 28);
    ctx.lineTo(308, 78 + i * 28);
    ctx.stroke();
  }

  if (kind === 0) {
    const heights = [46, 78, 58, 96, 72, 110, 88];
    heights.forEach((h, i) => {
      ctx.fillStyle = i % 3 === 0 ? "#b6f472" : "#5aa82f";
      ctx.fillRect(26 + i * 40, 170 - h, 22, h);
    });
  } else if (kind === 1) {
    ctx.strokeStyle = "#8fe04a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    [130, 96, 112, 70, 84, 44, 60].forEach((y, i) => {
      const x = 24 + i * 44;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "rgba(143,224,74,0.16)";
    ctx.lineTo(288, 180);
    ctx.lineTo(24, 180);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(143,224,74,0.5)";
    ctx.lineWidth = 2;
    [[60, 120], [150, 70], [240, 110], [110, 160], [200, 150]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#b6f472";
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(60, 120);
    ctx.lineTo(150, 70);
    ctx.lineTo(240, 110);
    ctx.lineTo(200, 150);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(60, 120);
    ctx.lineTo(110, 160);
    ctx.lineTo(200, 150);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeTruckSideTexture(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 1024, 384);
  ctx.fillStyle = "#0d150f";
  ctx.font = "800 150px Sora, Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("get", 210, 150);
  ctx.fillStyle = "#63b32e";
  ctx.fillText("TMS", 452, 150);
  ctx.fillStyle = "rgba(13,21,15,0.55)";
  ctx.font = "600 54px Inter, sans-serif";
  ctx.fillText(`FRETE ${name}`, 214, 268);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFacadeTexture(wall: string, glass: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 12;
  const padX = 10;
  const padY = 12;
  const cellW = (128 - padX * 2) / cols;
  const cellH = (256 - padY * 2) / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      ctx.fillStyle = Math.random() > 0.35 ? glass : "rgba(255,255,255,0.55)";
      ctx.fillRect(
        padX + c * cellW + cellW * 0.16,
        padY + r * cellH + cellH * 0.2,
        cellW * 0.68,
        cellH * 0.55,
      );
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createLogisticsScene(
  canvas: HTMLCanvasElement,
  options: { quality?: "high" | "low" } = {},
): LogisticsSceneHandle {
  const low = options.quality === "low";

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !low,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.09;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c9e2);
  scene.fog = new THREE.FogExp2(0xe2edf5, 0.0014);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
  camera.position.set(38, 17, 42);

  const shadowTexture = makeShadowTexture();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  // ---------------------------------------------------------------- céu
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x8fb8d8) },
        uBottom: { value: new THREE.Color(0xdcebf5) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        varying vec3 vPos;
        void main() {
          float h = clamp(vPos.y / 400.0, 0.0, 1.0);
          gl_FragColor = vec4(mix(uBottom, uTop, pow(h, 0.8)), 1.0);
        }
      `,
    }),
  );
  scene.add(sky);

  // ---------------------------------------------------------------- chão
  const groundUniforms = {
    uProgress: { value: 0 },
    uLine: { value: new THREE.Color(0x93a98a) },
    uBase: { value: new THREE.Color(0xe4eade) },
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: groundUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uProgress;
        uniform vec3 uLine;
        uniform vec3 uBase;
        varying vec3 vWorld;

        float gridLine(float v, float spacing, float width) {
          float d = abs(fract(v / spacing - 0.5) - 0.5) * spacing;
          return 1.0 - smoothstep(0.0, width, d);
        }

        void main() {
          float dist = length(vWorld.xz);
          float fade = 1.0 - smoothstep(60.0, 260.0, dist);
          float reveal = smoothstep(0.0, 1.0, 0.3 + uProgress * 1.4 - dist / 220.0);
          float small = gridLine(vWorld.x, 4.0, 0.07) + gridLine(vWorld.z, 4.0, 0.07);
          float big = gridLine(vWorld.x, 20.0, 0.14) + gridLine(vWorld.z, 20.0, 0.14);
          float g = clamp(small * 0.55 + big * 1.1, 0.0, 1.0);
          vec3 col = mix(uBase, uLine, g * 0.9);
          float alpha = (0.06 + g * 0.5) * fade * reveal;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  scene.add(ground);
  // base opaca para o piso não deixar o céu aparecer
  const floorBase = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0xeef2e6, roughness: 1, metalness: 0 }),
  );
  floorBase.rotation.x = -Math.PI / 2;
  floorBase.position.y = -0.06;
  scene.add(floorBase);
  // nuvens
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const cloudGeo = new THREE.SphereGeometry(1, 12, 10);
  const clouds = new THREE.Group();
  for (let c = 0; c < 9; c += 1) {
    const cluster = new THREE.Group();
    const puffs = 4 + (c % 3);
    for (let i = 0; i < puffs; i += 1) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set((i - puffs / 2) * 9 + Math.sin(i * 2.1) * 3, Math.cos(i * 1.7) * 2.4, Math.sin(i * 3.3) * 4);
      puff.scale.set(9 - i * 0.5, 4.2, 7);
      cluster.add(puff);
    }
    const angle = (c / 9) * Math.PI * 2;
    const radius = 120 + (c % 4) * 32;
    cluster.position.set(Math.cos(angle) * radius, 62 + (c % 3) * 22, Math.sin(angle) * radius - 50);
    cluster.rotation.y = angle;
    clouds.add(cluster);
  }
  scene.add(clouds);

  // ---------------------------------------------------------------- luzes
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d3c2, 1.1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.34));

  const key = new THREE.DirectionalLight(0xfff8ec, 2.7);
  key.position.set(30, 50, 30);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xb8e88f, 0.6);
  rim.position.set(-40, 18, -34);
  scene.add(rim);

  const cool = new THREE.DirectionalLight(0xc3d2f2, 0.35);
  cool.position.set(8, 12, -60);
  scene.add(cool);

  // ---------------------------------------------------------------- morros
  const hillMat = new THREE.MeshStandardMaterial({ color: 0xd8e0cc, roughness: 0.95, metalness: 0 });
  const hillGeo = new THREE.SphereGeometry(1, 20, 14);
  const hills = new THREE.Group();
  for (let i = 0; i < 9; i += 1) {
    const hill = new THREE.Mesh(hillGeo, hillMat);
    const r = 26 + Math.random() * 34;
    hill.scale.set(r * 1.7, r * 0.32, r * 1.4);
    hill.position.set(-260 + i * 62 + Math.random() * 20, -r * 0.16, -300 - Math.random() * 70);
    hills.add(hill);
  }
  scene.add(hills);

  // ---------------------------------------------------------------- árvores
  const treeCount = low ? 26 : 46;
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6f6049, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 0.85, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeCount);
  const treeDummy = new THREE.Object3D();
  const treePositions: [number, number, number][] = [];
  for (let i = 0; i < treeCount; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    let z = 44 - i * 4.6 - Math.random() * 3;
    let x = side * (12 + Math.random() * 16);
    // não planta árvore no pátio do CD nem na via de acesso
    if (Math.abs(x) < 9) x = side * 11;
    if (x > 26 && z < -28) z = -18 + Math.random() * 6;
    const s = 0.8 + Math.random() * 0.6;
    treePositions.push([x, z, s]);
    treeDummy.position.set(x, 0.8 * s, z);
    treeDummy.scale.setScalar(s);
    treeDummy.rotation.y = Math.random() * Math.PI;
    treeDummy.updateMatrix();
    trunks.setMatrixAt(i, treeDummy.matrix);
    treeDummy.position.set(x, (1.6 + 1.1) * s, z);
    treeDummy.scale.setScalar(s * (0.9 + Math.random() * 0.3));
    treeDummy.updateMatrix();
    leaves.setMatrixAt(i, treeDummy.matrix);
  }
  const treeGroup = new THREE.Group();
  treeGroup.add(trunks, leaves);
  treeGroup.scale.y = 0.001;
  scene.add(treeGroup);

  // ---------------------------------------------------------------- pista
  const road = new THREE.Group();
  scene.add(road);

  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x151c17,
    roughness: 0.9,
    metalness: 0.12,
    transparent: true,
    opacity: 0,
  });
  const asphalt = new THREE.Mesh(round(12, 0.3, 260, 0.12, 2), asphaltMat);
  asphalt.position.set(0, 0.1, -30);
  road.add(asphalt);

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xf3f6ee,
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    opacity: 0,
  });
  [-6.3, 6.3].forEach((x) => {
    const curb = new THREE.Mesh(round(0.55, 0.34, 260, 0.14, 2), curbMat);
    curb.position.set(x, 0.16, -30);
    road.add(curb);
  });

  const edgeMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0 });
  [-5.7, 5.7].forEach((x) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 260), edgeMat);
    edge.position.set(x, 0.27, -30);
    road.add(edge);
  });

  // malha viária conectada
  const gridRoadMat = new THREE.MeshStandardMaterial({
    color: 0x232b25,
    roughness: 0.92,
    metalness: 0.1,
    transparent: true,
    opacity: 0,
  });
  const gridRoads: THREE.Mesh[] = [];
  const addStreet = (x: number, z: number, length: number, horizontal: boolean) => {
    const street = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? length : 9, horizontal ? 9 : length), gridRoadMat);
    street.rotation.x = -Math.PI / 2;
    if (!horizontal) street.rotation.z = Math.PI / 2;
    street.position.set(x, 0.045, z);
    road.add(street);
    gridRoads.push(street);
  };
  [-150, -96, 30, 84, 138, 192].forEach((z) => addStreet(0, z, 420, true));
  [-210, -150, -60, 64, 128, 190, 250].forEach((x) => addStreet(x, -20, 460, false));
  addStreet(0, -52, 180, false);
  addStreet(0, 6, 120, false);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7fff0, transparent: true, opacity: 0 });
  const dashCount = 88;
  const dashes = new THREE.InstancedMesh(round(0.2, 0.05, 3, 0.06, 1), dashMat, dashCount);
  const dashDummy = new THREE.Object3D();
  for (let i = 0; i < dashCount; i += 1) {
    dashDummy.position.set(i % 2 === 0 ? -2 : 2, 0.27, 88 - Math.floor(i / 2) * 5.8);
    dashDummy.updateMatrix();
    dashes.setMatrixAt(i, dashDummy.matrix);
  }
  road.add(dashes);

  // postes com braço curvo
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7c877c, roughness: 0.7, metalness: 0.3 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-9.6, 9.6].forEach((x) => {
    for (let i = 0; i < 7; i += 1) {
      const z = 40 - i * 22;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 8.4, 8), poleMat);
      pole.position.set(x, 4.2, z);
      road.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(x - Math.sign(x) * 0.9, 8.3, z);
      road.add(arm);
      const lamp = new THREE.Mesh(round(0.9, 0.16, 0.44, 0.06, 1), lampMat);
      lamp.position.set(x - Math.sign(x) * 1.75, 8.2, z);
      road.add(lamp);
    }
  });

  // ---------------------------------------------------------------- viaduto
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xdfe5d9, roughness: 0.85, metalness: 0.05 });
  // ---------------------------------------------------------------- armazém
  const warehouse = new THREE.Group();
  warehouse.position.set(-40, 0, -26);
  scene.add(warehouse);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf7f9f2, roughness: 0.7, metalness: 0.12 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd3dcc8, roughness: 0.75, metalness: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2b352c, roughness: 0.6, metalness: 0.4 });
  const stripMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.9 });
  const unitMat = new THREE.MeshStandardMaterial({ color: 0xb9c3b2, roughness: 0.7, metalness: 0.35 });

  const warehouseParts: THREE.Object3D[] = [];
  const doorMaterials: THREE.MeshBasicMaterial[] = [];

  const body = new THREE.Mesh(round(26, 10, 20, 0.5, 3), wallMat);
  body.position.y = 5;
  warehouse.add(body);
  warehouseParts.push(body);

  // telhado curvo (cilindro achatado) para quebrar a caixa
  const roofGeo = new THREE.CylinderGeometry(10.6, 10.6, 26.6, 28, 1, false, 0, Math.PI);
  roofGeo.rotateZ(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.scale.set(1, 0.26, 0.98);
  roof.position.set(0, 10, 0);
  warehouse.add(roof);
  warehouseParts.push(roof);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 20.2), stripMat);
  strip.position.set(13.05, 9.2, 0);
  warehouse.add(strip);
  warehouseParts.push(strip);

  const frontStrip = new THREE.Mesh(new THREE.BoxGeometry(26.2, 0.2, 0.16), stripMat);
  frontStrip.position.set(0, 9.2, 10.05);
  warehouse.add(frontStrip);
  warehouseParts.push(frontStrip);

  const plinth = new THREE.Mesh(round(26.6, 0.7, 20.6, 0.2, 2), trimMat);
  plinth.position.y = 0.35;
  warehouse.add(plinth);
  warehouseParts.push(plinth);

  // docas
  for (let i = 0; i < 4; i += 1) {
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0 });
    doorMaterials.push(doorMat);
    const door = new THREE.Mesh(round(0.2, 4.6, 3.6, 0.08, 2), doorMat);
    door.position.set(13.06, 2.5, -6.6 + i * 4.4);
    warehouse.add(door);
    warehouseParts.push(door);

    const lintel = new THREE.Mesh(round(0.8, 0.4, 4, 0.12, 2), trimMat);
    lintel.position.set(13.15, 5.1, -6.6 + i * 4.4);
    warehouse.add(lintel);
    warehouseParts.push(lintel);

    const canopy = new THREE.Mesh(round(3.4, 0.26, 4.4, 0.1, 2), trimMat);
    canopy.position.set(14.3, 5.8, -6.6 + i * 4.4);
    warehouse.add(canopy);
    warehouseParts.push(canopy);

    const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 10), trimMat);
    bumper.rotation.x = Math.PI / 2;
    bumper.position.set(13.3, 1, -8 + i * 4.4);
    warehouse.add(bumper);
    warehouseParts.push(bumper);
  }

  // rampa de doca
  const ramp = new THREE.Mesh(round(4, 1.3, 9, 0.2, 2), concreteMat);
  ramp.position.set(16, 0.65, 0);
  warehouse.add(ramp);
  warehouseParts.push(ramp);

  // equipamentos no telhado
  [
    [-8, -4],
    [-1, 4],
    [7, -1],
  ].forEach(([x, z]) => {
    const unit = new THREE.Mesh(round(2.6, 1, 2.2, 0.2, 2), unitMat);
    unit.position.set(x, 12.2, z);
    warehouse.add(unit);
    warehouseParts.push(unit);
  });

  // placa da marca
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 1024;
  signCanvas.height = 256;
  const signCtx = signCanvas.getContext("2d")!;
  signCtx.clearRect(0, 0, 1024, 256);
  signCtx.fillStyle = "#0d150f";
  signCtx.font = "700 150px Sora, Inter, sans-serif";
  signCtx.textBaseline = "middle";
  signCtx.fillText("get", 250, 138);
  signCtx.fillStyle = "#63b32e";
  signCtx.fillText("TMS", 500, 138);
  const signTexture = track(new THREE.CanvasTexture(signCanvas));
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.25),
    new THREE.MeshBasicMaterial({ map: signTexture, transparent: true }),
  );
  sign.position.set(0, 7.6, 10.14);
  warehouse.add(sign);
  warehouseParts.push(sign);

  const dockLight = new THREE.PointLight(0xffdba0, 40, 40, 2);
  dockLight.position.set(16, 4.4, 0);
  warehouse.add(dockLight);

  const dockShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 26),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  dockShadow.rotation.x = -Math.PI / 2;
  dockShadow.position.set(6, 0.06, 0);
  warehouse.add(dockShadow);
  warehouseParts.push(dockShadow);

  warehouse.scale.y = 0.001;

  // ---------------------------------------------------------------- empilhadeira
  const forklift = new THREE.Group();
  forklift.position.set(9.5, 0, 3);
  forklift.rotation.y = -Math.PI / 2.6;
  scene.add(forklift);

  const liftBody = new THREE.Mesh(round(1.9, 1.3, 2.8, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0xf0b13a, roughness: 0.5, metalness: 0.35 }));
  liftBody.position.y = 1.05;
  forklift.add(liftBody);

  const liftSeat = new THREE.Mesh(round(0.8, 0.7, 0.8, 0.2, 2), trimMat);
  liftSeat.position.set(0, 1.95, -0.3);
  forklift.add(liftSeat);

  const mast = new THREE.Mesh(round(0.35, 3.2, 0.3, 0.1, 2), trimMat);
  mast.position.set(0, 1.9, 1.35);
  forklift.add(mast);

  const fork = new THREE.Mesh(round(0.18, 0.14, 1.5, 0.06, 1), trimMat);
  fork.position.set(0.32, 0.28, 2.2);
  forklift.add(fork);
  const fork2 = fork.clone();
  fork2.position.x = -0.32;
  forklift.add(fork2);

  const liftWheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14);
  liftWheelGeo.rotateZ(Math.PI / 2);
  [
    [0.9, 1],
    [-0.9, 1],
    [0.9, -0.9],
    [-0.9, -0.9],
  ].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(liftWheelGeo, new THREE.MeshStandardMaterial({ color: 0x141a16, roughness: 0.9 }));
    wheel.position.set(x, 0.42, z);
    forklift.add(wheel);
  });

  forklift.scale.setScalar(0.001);

  // ---------------------------------------------------------------- paletes
  const palletMat = new THREE.MeshStandardMaterial({ color: 0xd9c7a3, roughness: 0.85 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xc9b58d, roughness: 0.8 });
  const palletGroup = new THREE.Group();
  scene.add(palletGroup);
  const palletSpots: [number, number, number][] = [
    [8, 0, -10],
    [8, 1.05, -10],
    [10.6, 0, -6],
    [8, 0, 8.6],
  ];
  palletSpots.forEach(([x, y, z], index) => {
    const pallet = new THREE.Group();
    const base = new THREE.Mesh(round(1.9, 0.18, 1.9, 0.05, 2), palletMat);
    base.position.y = 0.11;
    pallet.add(base);
    const box = new THREE.Mesh(round(1.7, 0.55, 1.7, 0.08, 2), boxMat);
    box.position.y = 0.5;
    pallet.add(box);
    pallet.position.set(x, y, z);
    pallet.scale.setScalar(0.001);
    pallet.userData.delay = index * 0.04;
    palletGroup.add(pallet);
  });

  // ---------------------------------------------------------------- contêineres
  type Crate = { mesh: THREE.Mesh; baseY: number; delay: number; spin: number };
  const crates: Crate[] = [];
  const crateColors = [BRAND_DEEP, 0xffffff, 0x24302a, 0x9bd65a, 0x4a5c50];

  const crateLayout = [
    { x: 15, y: 1.35, z: -13, color: 0 },
    { x: 15, y: 4.05, z: -13, color: 1 },
    { x: 21.4, y: 1.35, z: -13, color: 2 },
    { x: 21.4, y: 4.05, z: -13, color: 3 },
    { x: 15, y: 6.75, z: -13, color: 4 },
    { x: 18.2, y: 1.35, z: -20, color: 1 },
    { x: 18.2, y: 4.05, z: -20, color: 0 },
  ];

  crateLayout.forEach((layout, index) => {
    const mat = new THREE.MeshStandardMaterial({
      color: crateColors[layout.color % crateColors.length],
      roughness: 0.55,
      metalness: 0.4,
    });
    const mesh = new THREE.Mesh(round(6, 2.6, 2.5, 0.14, 3), mat);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 2.6, 2.5)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
    );
    mesh.add(edges);
    mesh.position.set(layout.x, layout.y + 8, layout.z);
    mesh.scale.setScalar(0.001);
    scene.add(mesh);
    if (index < 3) {
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 7),
        new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.4, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(layout.x, 0.07, layout.z);
      scene.add(shadow);
    }
    crates.push({ mesh, baseY: layout.y, delay: index * 0.015, spin: (index % 2 === 0 ? 1 : -1) * 0.5 });
  });

  // ---------------------------------------------------------------- cidade
  const city = new THREE.Group();
  city.position.set(-4, 0, -132);
  scene.add(city);

  const facadeTextures = [
    track(makeFacadeTexture("#eef2e9", "rgba(40,56,44,0.55)")),
    track(makeFacadeTexture("#f4f7f0", "rgba(60,78,64,0.45)")),
    track(makeFacadeTexture("#e6ecdf", "rgba(30,44,34,0.6)")),
  ];

  type Tower = { mesh: THREE.Mesh; height: number; delay: number };
  const towers: Tower[] = [];
  const towerLayout = [
    { x: -40, z: 6, w: 10, d: 10, h: 26 },
    { x: -26, z: -12, w: 12, d: 12, h: 36 },
    { x: -16, z: 12, w: 9, d: 9, h: 18 },
    { x: 16, z: -14, w: 11, d: 11, h: 30 },
    { x: 26, z: 6, w: 10, d: 10, h: 22 },
    { x: 40, z: -10, w: 12, d: 12, h: 40 },
    { x: -50, z: -18, w: 9, d: 9, h: 16 },
    { x: 52, z: 10, w: 9, d: 9, h: 20 },
    { x: -22, z: 24, w: 8, d: 8, h: 14 },
    { x: 22, z: 26, w: 8, d: 8, h: 16 },
    { x: 34, z: 22, w: 9, d: 9, h: 24 },
    { x: -34, z: 22, w: 10, d: 10, h: 20 },
  ];

  // horizonte distante
  const skyline = new THREE.Group();
  for (let i = 0; i < 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2 + Math.sin(i) * 0.06;
    const radius = 200 + ((i * 37) % 150);
    const w = 8 + ((i * 13) % 14);
    const h = 16 + ((i * 29) % 62);
    const facade = facadeTextures[i % facadeTextures.length].clone();
    facade.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(2, Math.round(h / 8)));
    facade.needsUpdate = true;
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.9),
      new THREE.MeshStandardMaterial({ map: facade, color: i % 3 === 0 ? 0xe3e9dd : 0xf2f5ee, roughness: 0.95 }),
    );
    tower.position.set(Math.cos(angle) * radius, h / 2 - 2, Math.sin(angle) * radius - 40);
    skyline.add(tower);
  }
  scene.add(skyline);
  towerLayout.forEach((tower, index) => {
    const texture = facadeTextures[index % facadeTextures.length].clone();
    texture.repeat.set(Math.max(1, Math.round(tower.w / 8)), Math.max(2, Math.round(tower.h / 12)));
    texture.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.1 });
    const mesh = new THREE.Mesh(round(tower.w, tower.h, tower.d, 0.35, 2), mat);
    mesh.position.set(tower.x, tower.h / 2, tower.z);
    mesh.scale.y = 0.001;
    city.add(mesh);
    const cap = new THREE.Mesh(round(tower.w * 0.6, 0.6, tower.d * 0.6, 0.2, 2), unitMat);
    cap.position.set(tower.x, tower.h + 0.3, tower.z);
    cap.scale.y = 0.001;
    city.add(cap);
    towers.push({ mesh, height: tower.h, delay: index * 0.03 });
    mesh.userData.cap = cap;
  });

  // ---------------------------------------------------------------- hub de entrega
  const hub = new THREE.Group();
  hub.position.set(22, 0, -66);
hub.scale.setScalar(1.15);
  scene.add(hub);

  const hubBody = new THREE.Mesh(round(14, 6, 10, 0.4, 3), wallMat);
  hubBody.position.set(-9, 3, 0);
  hub.add(hubBody);

  const hubRoof = new THREE.Mesh(round(15.4, 0.5, 11.4, 0.2, 2), roofMat);
  hubRoof.position.set(-9, 6.3, 0);
  hub.add(hubRoof);

  const hubAccent = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.2, 0.16), stripMat);
  hubAccent.position.set(-9, 5.6, 5.1);
  hub.add(hubAccent);

  const hubDoorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const hubDoor = new THREE.Mesh(round(0.2, 3.4, 3.4, 0.08, 2), hubDoorMat);
  hubDoor.position.set(-1.94, 1.9, 0);
  hub.add(hubDoor);

  const parcelMat = new THREE.MeshStandardMaterial({ color: 0xd9c7a3, roughness: 0.8 });
  const tapeMat = new THREE.MeshBasicMaterial({ color: BRAND_DEEP });
  const parcels = new THREE.Group();
  [
    [3, 0.45, 2, 1.2],
    [4.6, 0.4, 1.2, 1],
    [3.2, 1.2, 2, 0.9],
  ].forEach(([x, y, z, size]) => {
    const parcel = new THREE.Group();
    const box = new THREE.Mesh(round(size, size, size, 0.06, 2), parcelMat);
    parcel.add(box);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(size * 1.01, size * 1.01, size * 0.18), tapeMat);
    parcel.add(tape);
    parcel.position.set(x, y, z);
    parcels.add(parcel);
  });
  hub.add(parcels);

  hub.visible = false;
  const hubShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 22),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  hubShadow.rotation.x = -Math.PI / 2;
  hubShadow.position.set(-4, 0.06, 0);
  hub.add(hubShadow);

  hub.scale.y = 0.001;

  // ---------------------------------------------------------------- caminhão
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x39423a, roughness: 0.95 });
  const laneMat = new THREE.MeshBasicMaterial({ color: 0xe9f2e0 });
  const accessRoad = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 104), roadMat);
  accessRoad.rotation.x = -Math.PI / 2;
  accessRoad.position.set(0, 0.05, -52);
  scene.add(accessRoad);
  for (let i = 0; i < 12; i += 1) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.4), laneMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.06, -4 - i * 8.5);
    scene.add(dash);
  }
  const dockRoad = new THREE.Mesh(new THREE.PlaneGeometry(78, 9), roadMat);
  dockRoad.rotation.x = -Math.PI / 2;
  dockRoad.position.set(30, 0.05, -99);
  scene.add(dockRoad);
  const sideRoad = new THREE.Mesh(new THREE.PlaneGeometry(200, 9), roadMat);
  sideRoad.rotation.x = -Math.PI / 2;
  sideRoad.position.set(-70, 0.05, 18);
  scene.add(sideRoad);
  const dockRoadLink = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 40), roadMat);
  dockRoadLink.rotation.x = -Math.PI / 2;
  dockRoadLink.position.set(0, 0.05, -90);
  scene.add(dockRoadLink);

  const truckPath = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-3.6, 0, -6),
      new THREE.Vector3(-3.6, 0, -60),
      new THREE.Vector3(-3.6, 0, -92),
      new THREE.Vector3(12, 0, -99),
      new THREE.Vector3(40, 0, -99),
      new THREE.Vector3(58, 0, -99),
      new THREE.Vector3(60, 0, -106),
      new THREE.Vector3(60, 0, -99),
      new THREE.Vector3(40, 0, -99),
      new THREE.Vector3(14, 0, -99),
      new THREE.Vector3(-3.6, 0, -92),
      new THREE.Vector3(-3.6, 0, -50)
    ],
    true,
    "catmullrom",
    0.5,
  );

  const truck = new THREE.Group();
  const proceduralBodies: { group: THREE.Group; parts: THREE.Object3D[] }[] = [];
  type GlbRequest = { key: string; holder: THREE.Group; parts?: THREE.Object3D[]; length: number; rotY: number; color?: number; label?: string };
  const glbRequests: GlbRequest[] = [];
  const glbSources: Record<string, THREE.Object3D> = {};

  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  [-0.95, 0.95].forEach((x) => {
    const lamp = new THREE.Mesh(round(0.5, 0.26, 0.1, 0.06, 1), headlightMat);
    lamp.position.set(x, 1.75, 5.62);
    truck.add(lamp);
  });
  proceduralBodies.push({ group: truck, parts: [...truck.children] });
  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 640;
  tagCanvas.height = 200;
  const tagCtx = tagCanvas.getContext("2d")!;
  tagCtx.fillStyle = "rgba(10,16,11,0.92)";
  tagCtx.beginPath();
  tagCtx.roundRect(8, 8, 624, 184, 28);
  tagCtx.fill();
  tagCtx.fillStyle = "#8fe04a";
  tagCtx.beginPath();
  tagCtx.arc(46, 66, 12, 0, Math.PI * 2);
  tagCtx.fill();
  tagCtx.fillStyle = "#f4f8ef";
  tagCtx.font = "700 44px Sora, Inter, sans-serif";
  tagCtx.textBaseline = "middle";
  tagCtx.fillText("GT-1024", 74, 66);
  tagCtx.fillStyle = "#8fe04a";
  tagCtx.font = "600 26px Inter, sans-serif";
  tagCtx.fillText("PEDIDO #4821 · INDO PARA SÃO PAULO", 74, 128);
  tagCtx.fillStyle = "rgba(244,248,239,0.55)";
  tagCtx.font = "500 22px Inter, sans-serif";
  tagCtx.fillText("Tracking em tempo real · getTMS", 74, 166);
  const tagTex = track(new THREE.CanvasTexture(tagCanvas));
  tagTex.colorSpace = THREE.SRGBColorSpace;
  const tagSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthWrite: false }));
  tagSprite.scale.set(11, 3.4, 1);
  tagSprite.position.set(0, 8.4, -2);
  truck.add(tagSprite);

  const headGlow = new THREE.PointLight(0xffe7b0, 26, 26, 2);
  headGlow.position.set(0, 1.9, 6.4);
  truck.add(headGlow);

  truck.scale.setScalar(0.9);
  scene.add(truck);

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f7f2, roughness: 0.38, metalness: 0.12 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xe3e9dc, roughness: 0.4, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a221c, roughness: 0.4, metalness: 0.7 });
  const truckChrome = new THREE.MeshStandardMaterial({ color: 0xd8dee2, roughness: 0.18, metalness: 0.95 });
  const truckBumper = new THREE.Mesh(round(2.95, 0.38, 0.3, 0.1, 2), truckChrome);
  truckBumper.position.set(0, 0.95, 5.72);
  truck.add(truckBumper);
  const cabGrille = new THREE.Mesh(round(2.2, 1.1, 0.16, 0.08, 2), darkMat);
  cabGrille.position.set(0, 2.05, 5.7);
  truck.add(cabGrille);
  for (let i = 0; i < 3; i += 1) {
    const grilleBar = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.07, 0.1), truckChrome);
    grilleBar.position.set(0, 1.72 + i * 0.32, 5.78);
    truck.add(grilleBar);
  }
  const cabFuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.7, 16), truckChrome);
  cabFuelTank.rotation.x = Math.PI / 2;
  cabFuelTank.position.set(-1.42, 1.05, 2.2);
  truck.add(cabFuelTank);
  const cabFuelTank2 = cabFuelTank.clone();
  cabFuelTank2.position.x = 1.42;
  truck.add(cabFuelTank2);
  const cabExhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), truckChrome);
  cabExhaust.position.set(-1.32, 3.6, 2.6);
  truck.add(cabExhaust);
  [-1.1, 1.1].forEach((x) => {
    const cabMudFlap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), darkMat);
    cabMudFlap.position.set(x, 0.45, -9.6);
    truck.add(cabMudFlap);
  });

  const truckLedBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.08), new THREE.MeshBasicMaterial({ color: 0xf4ffe4 }));
  truckLedBar.position.set(0, 3.05, 5.66);
  truck.add(truckLedBar);
  [-1.58, 1.58].forEach((x) => {
    const truckMirror = new THREE.Mesh(round(0.1, 0.5, 0.34, 0.06, 2), darkMat);
    truckMirror.position.set(x, 3.35, 5.15);
    truck.add(truckMirror);
    const truckMirrorArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), truckChrome);
    truckMirrorArm.rotation.z = Math.PI / 2;
    truckMirrorArm.position.set(x * 0.9, 3.5, 5.2);
    truck.add(truckMirrorArm);
  });
  const truckSunVisor = new THREE.Mesh(round(2.7, 0.16, 0.7, 0.06, 2), whiteMat);
  truckSunVisor.position.set(0, 4.05, 5.25);
  truckSunVisor.rotation.x = -0.18;
  truck.add(truckSunVisor);
  const truckTailBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.08), new THREE.MeshBasicMaterial({ color: 0xff3b2f }));
  truckTailBar.position.set(0, 1.5, -8.6);
  truck.add(truckTailBar);


  const greenMat = new THREE.MeshBasicMaterial({ color: BRAND });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc7d0c4, roughness: 0.22, metalness: 1 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1418,
    roughness: 0.06,
    metalness: 0.96,
    emissive: 0x1d3a47,
    emissiveIntensity: 0.75,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0d0f0d, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa39a, roughness: 0.3, metalness: 0.9 });

  // baú
  const trailer = new THREE.Mesh(round(2.95, 3.4, 12, 0.26, 4), whiteMat);
  trailer.position.set(0, 3.05, -3.8);
  truck.add(trailer);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xe2e8dc, roughness: 0.75, metalness: 0.1 });
  for (let i = 0; i < 7; i += 1) {
    [-1.49, 1.49].forEach((x) => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.9, 0.12), ribMat);
      rib.position.set(x, 3.05, -9 + i * 1.55);
      truck.add(rib);
    });
  }
  const trailerStripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.97, 0.16, 11.8),
    new THREE.MeshStandardMaterial({ color: BRAND_DEEP, roughness: 0.5, metalness: 0.2 }),
  );
  trailerStripe.position.set(0, 1.55, -3.8);
  truck.add(trailerStripe);
  const trailerSkirt = new THREE.Mesh(round(2.8, 0.42, 11.4, 0.08, 1), darkMat);
  trailerSkirt.position.set(0, 0.85, -3.8);
  truck.add(trailerSkirt);

  // costelas laterais
  for (let i = 0; i < 8; i += 1) {
    [-1.49, 1.49].forEach((x) => {
      const rib = new THREE.Mesh(round(0.07, 3.1, 0.16, 0.03, 1), shellMat);
      rib.position.set(x, 3.05, -8.6 + i * 1.35);
      truck.add(rib);
    });
  }

  // rodapé e faixa verde
  const skirt = new THREE.Mesh(round(3, 0.55, 12, 0.16, 2), darkMat);
  skirt.position.set(0, 1.18, -3.8);
  truck.add(skirt);

  const stripe = new THREE.Mesh(round(3.02, 0.2, 12.02, 0.08, 2), greenMat);
  stripe.position.set(0, 1.55, -3.8);
  truck.add(stripe);

  const truckNames = ["GT-4821", "GT-1937", "GT-7712"];
  const truckNameTexture = track(makeTruckSideTexture(truckNames[0]));
  [-1.51, 1.51].forEach((x) => {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 2.02),
      new THREE.MeshBasicMaterial({ map: truckNameTexture, transparent: true }),
    );
    plate.position.set(x, 3.3, -3.8);
    plate.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    truck.add(plate);
  });

  // portas traseiras com dobradiças
  [-0.74, 0.74].forEach((x) => {
    const door = new THREE.Mesh(round(1.44, 3.2, 0.1, 0.06, 2), shellMat);
    door.position.set(x, 3.05, -9.82);
    truck.add(door);
    [-1.2, 1.2].forEach((y) => {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), chromeMat);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(x, 3.05 + y, -9.92);
      truck.add(hinge);
    });
  });

  // cabine moderna
  const cab = new THREE.Mesh(round(2.85, 3, 2.3, 0.55, 4), whiteMat);
  cab.position.set(0, 2.45, 4.4);
  truck.add(cab);

  const nose = new THREE.Mesh(round(2.72, 1.3, 1.2, 0.45, 3), whiteMat);
  nose.position.set(0, 1.45, 5.9);
  truck.add(nose);

  const bumper = new THREE.Mesh(round(2.86, 0.62, 0.5, 0.22, 2), darkMat);
  bumper.position.set(0, 0.95, 6.32);
  truck.add(bumper);

  const windshield = new THREE.Mesh(round(2.55, 1.65, 0.14, 0.14, 2), glassMat);
  windshield.position.set(0, 3.15, 5.6);
  windshield.rotation.x = -0.1;
  truck.add(windshield);

  const visor = new THREE.Mesh(round(2.55, 0.14, 0.3, 0.06, 2), darkMat);
  visor.position.set(0, 4.02, 5.72);
  truck.add(visor);

  [-1.47, 1.47].forEach((x) => {
    const sideWindow = new THREE.Mesh(round(0.1, 1.05, 1.5, 0.14, 2), glassMat);
    sideWindow.position.set(x, 3.2, 4.85);
    truck.add(sideWindow);

    const mirrorArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), darkMat);
    mirrorArm.rotation.z = Math.PI / 2;
    mirrorArm.position.set(x * 1.18, 3.75, 5.6);
    truck.add(mirrorArm);

    const mirror = new THREE.Mesh(round(0.2, 0.7, 0.12, 0.06, 2), darkMat);
    mirror.position.set(x * 1.32, 3.6, 5.62);
    truck.add(mirror);

    // farol em LED
    const led = new THREE.Mesh(round(0.62, 0.16, 0.12, 0.06, 2), new THREE.MeshBasicMaterial({ color: 0xf4ffe0 }));
    led.position.set(x * 0.82, 1.62, 6.6);
    truck.add(led);

    const fog = new THREE.Mesh(round(0.24, 0.16, 0.1, 0.06, 2), new THREE.MeshBasicMaterial({ color: 0xe8ffc8 }));
    fog.position.set(x * 1.05, 1.05, 6.58);
    truck.add(fog);

    // degraus
    [1.15, 1.7].forEach((y, i) => {
      const step = new THREE.Mesh(round(0.6, 0.08, 0.36, 0.03, 1), darkMat);
      step.position.set(x * 1.28, y, 4.55 + i * 0.06);
      truck.add(step);
    });
  });

  // grade frontal com filetes cromados
  const grille = new THREE.Mesh(round(2.3, 0.9, 0.14, 0.08, 2), darkMat);
  grille.position.set(0, 2.15, 6.58);
  truck.add(grille);
  [-0.28, 0, 0.28].forEach((y) => {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 0.06), chromeMat);
    slat.position.set(0, 2.15 + y, 6.66);
    truck.add(slat);
  });

  // defletor de teto
  const fairing = new THREE.Mesh(round(2.75, 0.8, 1.6, 0.38, 3), whiteMat);
  fairing.position.set(0, 4.3, 4.3);
  truck.add(fairing);

  const lightBar = new THREE.Mesh(round(2.3, 0.14, 0.16, 0.06, 2), greenMat);
  lightBar.position.set(0, 4.12, 6.42);
  truck.add(lightBar);

  // escapamento e tanque
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.8, 10), chromeMat);
  exhaust.position.set(1.32, 2.3, 2.9);
  truck.add(exhaust);

  const tankGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.9, 16);
  tankGeo.rotateX(Math.PI / 2);
  const tank = new THREE.Mesh(tankGeo, chromeMat);
  tank.position.set(-1.55, 1.15, 2.6);
  truck.add(tank);

  const headlight = new THREE.PointLight(0xdcffb4, 26, 36, 2);
  headlight.position.set(0, 1.7, 7.8);
  truck.add(headlight);

  // rodas
  const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.55, 22);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.58, 18);
  rimGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.62, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const wheelSpots: [number, number, number][] = [
    [1.34, 0.7, 5.35],
    [-1.34, 0.7, 5.35],
    [1.34, 0.7, 1.55],
    [-1.34, 0.7, 1.55],
    [1.34, 0.7, -6.6],
    [-1.34, 0.7, -6.6],
    [1.34, 0.7, -8.5],
    [-1.34, 0.7, -8.5],
  ];
  wheelSpots.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(x, y, z);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(x * 1.03, y, z);
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    hub.position.set(x * 1.05, y, z);
    truck.add(wheel, rim, hub);
    wheels.push(wheel);
  });

  // pernas de apoio do baú
  [-0.9, 0.9].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), chromeMat);
    leg.position.set(x, 0.7, -0.4);
    truck.add(leg);
  });

  const truckShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 27),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.65, depthWrite: false }),
  );
  truckShadow.rotation.x = -Math.PI / 2;
  truckShadow.position.set(0, 0.2, 0);
  truck.add(truckShadow);

  truck.position.set(0, 0, 12);

  // ---------------------------------------------------------------- furgão (sentido oposto)
  const van = new THREE.Group();
  van.scale.setScalar(0.9);
  scene.add(van);

  const vanBody = new THREE.Mesh(round(2.1, 2.2, 4.8, 0.45, 4), whiteMat);
  vanBody.position.set(0, 1.5, 0);
  van.add(vanBody);

  const vanNose = new THREE.Mesh(round(2, 1.1, 1.3, 0.4, 3), whiteMat);
  vanNose.position.set(0, 1.05, 2.85);
  van.add(vanNose);

  const vanGlass = new THREE.Mesh(round(1.85, 0.85, 0.1, 0.12, 2), glassMat);
  vanGlass.position.set(0, 1.95, 2.5);
  van.add(vanGlass);

  const vanStripe = new THREE.Mesh(round(2.14, 0.2, 4.2, 0.1, 2), greenMat);
  vanStripe.position.set(0, 1.2, -0.1);
  van.add(vanStripe);

  const vanWheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.32, 14);
  vanWheelGeo.rotateZ(Math.PI / 2);
  [
    [1.02, 1.6],
    [-1.02, 1.6],
    [1.02, -1.5],
    [-1.02, -1.5],
  ].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(vanWheelGeo, tireMat);
    wheel.position.set(x, 0.46, z);
    van.add(wheel);
  });

  const vanShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 8),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  vanShadow.rotation.x = -Math.PI / 2;
  vanShadow.position.y = 0.12;
  van.add(vanShadow);

  van.position.set(-3.2, 0, -110);
  van.rotation.y = Math.PI;

  // ---------------------------------------------------------------- pessoas
  type Person = {
    group: THREE.Group;
    legL: THREE.Object3D;
    legR: THREE.Object3D;
    armL: THREE.Object3D;
    armR: THREE.Object3D;
    phase: number;
    base: THREE.Vector3;
    walkAxis: "z" | "x" | null;
    walkRange: number;
    delay: number;
  };
  const people: Person[] = [];

  const skinMats = [
    new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xa9744f, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x6f4a32, roughness: 0.8 }),
  ];
  const pantMat = new THREE.MeshStandardMaterial({ color: 0x27302a, roughness: 0.85 });

  function addPerson(
    x: number,
    z: number,
    rotation: number,
    vest: number,
    walkAxis: "z" | "x" | null = null,
    walkRange = 3,
    delay = 0,
  ) {
    const group = new THREE.Group();
    const vestMat = new THREE.MeshStandardMaterial({ color: vest, roughness: 0.55 });
    const skinMat = skinMats[people.length % skinMats.length];

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skinMat);
    head.position.y = 1.63;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: vest === 0xf0b13a ? 0xf0b13a : 0xffffff, roughness: 0.5 }));
    helmet.position.y = 1.66;
    const torso = new THREE.Mesh(round(0.44, 0.62, 0.27, 0.1, 2), vestMat);
    torso.position.y = 1.16;
    const hips = new THREE.Mesh(round(0.38, 0.3, 0.25, 0.08, 2), pantMat);
    hips.position.y = 0.8;

    const legGeo = round(0.15, 0.74, 0.17, 0.06, 1);
    const legL = new THREE.Mesh(legGeo, pantMat);
    legL.position.set(-0.1, 0.37, 0);
    const legR = new THREE.Mesh(legGeo, pantMat);
    legR.position.set(0.1, 0.37, 0);

    const armGeo = round(0.12, 0.58, 0.13, 0.05, 1);
    const armL = new THREE.Mesh(armGeo, vestMat);
    armL.position.set(-0.29, 1.12, 0);
    const armR = new THREE.Mesh(armGeo, vestMat);
    armR.position.set(0.29, 1.12, 0);

    group.add(head, helmet, torso, hips, legL, legR, armL, armR);
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    group.scale.setScalar(0.001);
    scene.add(group);

    people.push({
      group,
      legL,
      legR,
      armL,
      armR,
      phase: Math.random() * Math.PI * 2,
      base: new THREE.Vector3(x, 0, z),
      walkAxis,
      walkRange,
      delay,
    });
  }


  // ---------------------------------------------------------------- carros
  type Car = { group: THREE.Group; wheels: THREE.Mesh[]; speed: number; offset: number; lane: number; dir: number; delay: number };
  const cars: Car[] = [];

  function addCar(color: number, lane: number, dir: number, speed: number, offset: number, delay: number) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.65 });

    const body = new THREE.Mesh(round(1.95, 0.72, 4.3, 0.3, 3), bodyMat);
    body.position.y = 0.66;
    const cabin = new THREE.Mesh(round(1.72, 0.62, 2.2, 0.28, 3), glassMat);
    cabin.position.set(0, 1.2, -0.1);
    const roof = new THREE.Mesh(round(1.66, 0.1, 2, 0.06, 2), bodyMat);
    roof.position.set(0, 1.5, -0.1);

    const frontLight = new THREE.Mesh(round(1.5, 0.12, 0.1, 0.05, 2), new THREE.MeshBasicMaterial({ color: 0xf6ffe2 }));
    frontLight.position.set(0, 0.78, 2.18);
    const backLight = new THREE.Mesh(round(1.5, 0.12, 0.1, 0.05, 2), new THREE.MeshBasicMaterial({ color: 0xff6b5a }));
    backLight.position.set(0, 0.78, -2.18);

    group.add(body, cabin, roof, frontLight, backLight);

    const carWheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
    carWheelGeo.rotateZ(Math.PI / 2);
    const carWheels: THREE.Mesh[] = [];
    [
      [0.95, 1.35],
      [-0.95, 1.35],
      [0.95, -1.35],
      [-0.95, -1.35],
    ].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(carWheelGeo, tireMat);
      wheel.position.set(x, 0.36, z);
      group.add(wheel);
      carWheels.push(wheel);
    });

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 6),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.12;
    group.add(shadow);

    group.position.set(lane, 0, 40);
    group.rotation.y = dir > 0 ? 0 : Math.PI;
    group.scale.setScalar(0.001);
    scene.add(group);
    cars.push({ group, wheels: carWheels, speed, offset, lane, dir, delay });
  }

  addCar(0xffffff, 2.9, 1, 0.055, 0.15, 0.06);
  addCar(0x63b32e, 2.9, 1, 0.042, 0.62, 0.08);
  addCar(0x2f3a34, -2.9, -1, 0.05, 0.35, 0.07);
  addCar(0xe8ede4, -2.9, -1, 0.038, 0.82, 0.09);

  // ---------------------------------------------------------------- drone
  const drone = new THREE.Group();
  scene.add(drone);

  const droneBody = new THREE.Mesh(round(0.5, 0.18, 0.5, 0.08, 2), darkMat);
  drone.add(droneBody);
  const droneTop = new THREE.Mesh(round(0.28, 0.12, 0.28, 0.06, 2), greenMat);
  droneTop.position.y = 0.12;
  drone.add(droneTop);

  const rotorGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12);
  const rotors: THREE.Mesh[] = [];
  [
    [0.36, 0.36],
    [-0.36, 0.36],
    [0.36, -0.36],
    [-0.36, -0.36],
  ].forEach(([x, z]) => {
    const arm = new THREE.Mesh(round(0.5, 0.05, 0.06, 0.02, 1), darkMat);
    arm.position.set(x / 2, 0, z / 2);
    arm.rotation.y = Math.atan2(z, x);
    drone.add(arm);
    const rotor = new THREE.Mesh(rotorGeo, new THREE.MeshBasicMaterial({ color: 0xdfffc8, transparent: true, opacity: 0.55 }));
    rotor.position.set(x, 0.06, z);
    drone.add(rotor);
    rotors.push(rotor);
  });

  const droneLed = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff6b5a }));
  droneLed.position.y = -0.12;
  drone.add(droneLed);

  const droneBeam = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 6, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }),
  );
  droneBeam.position.y = -3;
  droneBeam.rotation.x = Math.PI;
  drone.add(droneBeam);

  drone.scale.setScalar(0.001);

  // ---------------------------------------------------------------- antena e sinais
  const antenna = new THREE.Group();
  antenna.position.set(34, 0, -96);
  scene.add(antenna);

  const antennaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 22, 8), poleMat);
  antennaMast.position.y = 11;
  antenna.add(antennaMast);

  for (let i = 0; i < 5; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4 - i * 0.3, 0.1, 0.1), poleMat);
    bar.position.y = 4 + i * 3.6;
    antenna.add(bar);
  }

  const antennaLed = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff6b5a }));
  antennaLed.position.y = 22.2;
  antenna.add(antennaLed);

  const dataRings: THREE.Mesh[] = [];
  [26, 34, 42].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 6, 64),
      new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.18 - index * 0.04 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1 + index * 0.6, -104);
    scene.add(ring);
    dataRings.push(ring);
  });

  // painéis solares no telhado
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d3348, roughness: 0.25, metalness: 0.7, emissive: 0x0b1622, emissiveIntensity: 0.5 });
  for (let i = 0; i < 3; i += 1) {
    const panel = new THREE.Mesh(round(3.2, 0.08, 2.4, 0.04, 1), panelMat);
    panel.position.set(-6 + i * 3.8, 11.5, 5.2);
    panel.rotation.x = -0.32;
    warehouse.add(panel);
    warehouseParts.push(panel);
  }

  // semáforo no viaduto
  const traffic = new THREE.Group();
  traffic.position.set(8.2, 0, -44);
  scene.add(traffic);
  const tPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 8), poleMat);
  tPole.position.y = 2.3;
  traffic.add(tPole);
  const tBox = new THREE.Mesh(round(0.5, 1.3, 0.4, 0.1, 2), darkMat);
  tBox.position.y = 4.9;
  traffic.add(tBox);
  [0.38, 0, -0.38].forEach((y, index) => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshBasicMaterial({ color: index === 2 ? BRAND : 0x3a443c }));
    light.position.set(0, 4.9 + y, 0.2);
    traffic.add(light);
  });

  const truckVariants = ["cab-over"];
  const truckColors = [0xffffff, 0x8fe04a, 0x63b32e, 0x2f6f4f, 0xdbe3d2, 0x2b3a30];
  let truckVariantIndex = 0;
  function makeSimpleTruck(name: string) {
    const group = new THREE.Group();
    const trailer = new THREE.Mesh(round(2.95, 3.4, 12, 0.24, 3), whiteMat);
    trailer.position.set(0, 3.05, -2.6);
    const skirt = new THREE.Mesh(round(3, 0.55, 12, 0.14, 1), darkMat);
    skirt.position.set(0, 1.18, -2.6);
    const stripe = new THREE.Mesh(round(3.02, 0.2, 12.02, 0.08, 1), greenMat);
    stripe.position.set(0, 1.55, -2.6);
    group.add(trailer, skirt, stripe);

    const texture = track(makeTruckSideTexture(name));
    [-1.51, 1.51].forEach((x) => {
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 2.02),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
      );
      plate.position.set(x, 3.3, -2.6);
      plate.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(plate);
    });

    const cab = new THREE.Mesh(round(2.85, 3, 2.3, 0.5, 3), whiteMat);
    cab.position.set(0, 2.45, 4.4);
    const cabGlass = new THREE.Mesh(round(2.6, 1.5, 2.34, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0x243029, roughness: 0.15, metalness: 0.85 }));
    cabGlass.position.set(0, 3.1, 4.42);
    const windshield = new THREE.Mesh(round(2.55, 1.6, 0.12, 0.1, 1), glassMat);
    windshield.position.set(0, 3.15, 5.58);
    const cabRoof = new THREE.Mesh(round(2.9, 0.22, 2.36, 0.12, 2), whiteMat);
    cabRoof.position.set(0, 4.02, 4.4);
    const fairing = new THREE.Mesh(round(2.75, 0.8, 1.6, 0.35, 2), whiteMat);
    fairing.position.set(0, 4.3, 4.3);
    const grille = new THREE.Mesh(round(2.3, 0.9, 0.14, 0.08, 2), darkMat);
    grille.position.set(0, 1.95, 5.62);
    const lampL = new THREE.Mesh(round(0.5, 0.26, 0.1, 0.06, 1), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
    lampL.position.set(0.86, 1.5, 5.64);
    const lampR = lampL.clone();
    lampR.position.x = -0.86;
    const bumper = new THREE.Mesh(round(2.9, 0.42, 0.3, 0.1, 2), new THREE.MeshStandardMaterial({ color: 0xd8dee2, roughness: 0.2, metalness: 0.9 }));
    bumper.position.set(0, 0.85, 5.66);
    group.add(cab, cabGlass, windshield, cabRoof, fairing, grille, lampL, lampR, bumper);
    const procedural = [...group.children];

    const simpleWheel = new THREE.CylinderGeometry(0.7, 0.7, 0.55, 12);
    simpleWheel.rotateZ(Math.PI / 2);
    [5.35, 1.55, -5.6, -7.4].forEach((z) => {
      [-1.34, 1.34].forEach((x) => {
        const wheel = new THREE.Mesh(simpleWheel, tireMat);
        wheel.position.set(x, 0.7, z);
        group.add(wheel);
      });
    });

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 27),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.2;
    group.add(shadow);
    proceduralBodies.push({ group, parts: procedural });
    const variant = truckVariants[truckVariantIndex % truckVariants.length];
    const color = truckColors[truckVariantIndex % truckColors.length];
    truckVariantIndex += 1;
    queueGlb({ key: variant, holder: group, parts: procedural, length: variant === "delivery-van" ? 12 : 15.4, rotY: 0, color, label: name });
    return group;
  }

  const parkedCars: THREE.Group[] = [];
  // estacionamento com vagas pintadas
  const lotPad = new THREE.Mesh(new THREE.PlaneGeometry(78, 22), new THREE.MeshStandardMaterial({ color: 0x2b332c, roughness: 0.95 }));
  lotPad.rotation.x = -Math.PI / 2;
  lotPad.position.set(-96, 0.05, 26);
  scene.add(lotPad);
  const bayLineMat = new THREE.MeshBasicMaterial({ color: 0xf3f7ee });
  for (let i = 0; i <= 9; i += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 5), bayLineMat);
    line.position.set(-96 - 4.5 + i * 9, 0.08, 26);
    scene.add(line);
  }
  const bayTop = new THREE.Mesh(new THREE.BoxGeometry(81, 0.02, 0.14), bayLineMat);
  bayTop.position.set(-96, 0.08, 23.5);
  scene.add(bayTop);
  const bayBottom = bayTop.clone();
  bayBottom.position.z = 28.5;
  scene.add(bayBottom);


  const visitors: { mesh: THREE.Group; phase: number }[] = [];
  // centros de distribuição espalhados pelo mapa
  function makeSmallDc(x: number, z: number, rotation: number, name: string, accent: number) {
    const dc = new THREE.Group();
    dc.position.set(x, 0, z);
    dc.rotation.y = rotation;

    const body = new THREE.Mesh(round(30, 9, 16, 0.5, 3), wallMat);
    body.position.y = 4.5;
    dc.add(body);
    const access = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 46), roadMat);
    access.rotation.x = -Math.PI / 2;
    access.position.set(0, 0.06, 30);
    dc.add(access);
    for (let i = 0; i < 5; i += 1) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 2.6), dashMat);
      dash.position.set(0, 0.09, 18 + i * 7);
      dc.add(dash);
    }
    [-3.5, 3.5].forEach((side) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 46), edgeMat);
      edge.position.set(side, 0.09, 30);
      dc.add(edge);
    });
    const roof = new THREE.Mesh(round(31.2, 0.5, 17.2, 0.25, 2), roofMat);
    roof.position.y = 9.2;
    dc.add(roof);
    const roofLed = new THREE.Mesh(new THREE.BoxGeometry(31, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: BRAND }));
    roofLed.position.set(0, 9.5, 8.6);
    dc.add(roofLed);
    [-8, 4].forEach((ux) => {
      const unit = new THREE.Mesh(round(3.4, 0.8, 2.2, 0.12, 2), new THREE.MeshStandardMaterial({ color: 0xc9d2c6, roughness: 0.6, metalness: 0.4 }));
      unit.position.set(ux, 9.9, -1);
      dc.add(unit);
    });
    const band = new THREE.Mesh(
      round(29, 3.4, 0.3, 0.1, 2),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.3 }),
    );
    band.position.set(0, 7, 8.1);
    dc.add(band);

    const signCanvas = document.createElement("canvas");
    signCanvas.width = 1024;
    signCanvas.height = 256;
    const ctx = signCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 1024, 256);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 110px Sora, Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 512, 100);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 38px Inter, sans-serif";
    ctx.fillText("CENTRO DE DISTRIBUIÇÃO · getTMS", 512, 190);
    const signTex = track(new THREE.CanvasTexture(signCanvas));
    signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
    sign.position.set(0, 7, 8.3);
    dc.add(sign);

    const canopy = new THREE.Mesh(round(26, 0.25, 4, 0.1, 2), concreteMat);
    canopy.position.set(0, 5.4, 10.2);
    dc.add(canopy);

    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    [-9, 0, 9].forEach((dx) => {
      const door = new THREE.Mesh(round(4.4, 4.4, 0.2, 0.08, 2), doorMat);
      door.position.set(dx, 2.4, 8.1);
      dc.add(door);
      const parked = makeSimpleTruck(["GT-1140", "GT-7788", "GT-9021"][(Math.round(dx / 9) + 1) % 3]);
      parked.position.set(dx, 0, 15);
      parked.rotation.y = Math.PI / 2;
      parked.scale.setScalar(0.9);
      dc.add(parked);
    });

    const visitor = makeSimpleTruck(`GT-${3100 + Math.round(Math.abs(x))}`);
    const orderCanvas = document.createElement("canvas");
    orderCanvas.width = 512;
    orderCanvas.height = 128;
    const orderCtx = orderCanvas.getContext("2d")!;
    orderCtx.fillStyle = "rgba(12,18,13,0.92)";
    orderCtx.beginPath();
    orderCtx.roundRect(6, 6, 500, 116, 22);
    orderCtx.fill();
    orderCtx.fillStyle = "#f4f8ef";
    orderCtx.font = "600 26px Inter, sans-serif";
    orderCtx.textBaseline = "middle";
    orderCtx.fillText(name.toUpperCase(), 30, 38);
    orderCtx.fillStyle = "#8fe04a";
    orderCtx.font = "700 40px Sora, Inter, sans-serif";
    orderCtx.fillText(`PEDIDO #${4800 + Math.round(Math.abs(x) * 3) % 180}`, 30, 84);
    const orderTex = track(new THREE.CanvasTexture(orderCanvas));
    orderTex.colorSpace = THREE.SRGBColorSpace;
    const orderTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: orderTex, transparent: true, depthWrite: false }));
    orderTag.scale.set(9, 2.25, 1);
    orderTag.position.set(0, 7.6, 0);
    visitor.add(orderTag);
    visitor.scale.setScalar(0.92);
    visitor.position.set(0, 0, 42);
    dc.add(visitor);
    visitors.push({ mesh: visitor, phase: Math.abs(x) * 0.013 });

    scene.add(dc);
    return dc;
  }

  makeSmallDc(-92, -34, Math.PI * 0.5, "CD ALIMENTOS", 0x63b32e);
  makeSmallDc(-72, 30, Math.PI, "CD FARMA", 0x2f9e8f);
  makeSmallDc(-118, 8, Math.PI * 0.5, "CD CONSTRUÇÃO", 0xc08a3e);
  makeSmallDc(-100, -92, Math.PI * 0.5, "CD BETA", 0x39443a);
  makeSmallDc(-150, -20, Math.PI * 0.5, "CD GAMA", 0x2f6f4f);
  makeSmallDc(-138, 52, Math.PI, "CD DELTA", 0x39443a);
  makeSmallDc(-172, -86, Math.PI * 0.5, "CD ÔMEGA", 0x2f6f4f);
  makeSmallDc(104, 30, -Math.PI * 0.5, "CD E-COMMERCE", 0x4a6fd6);
  makeSmallDc(-52, -112, Math.PI, "CD LESTE", 0x2f6f4f);

  // tráfego contínuo na via
  function makeStatusTag(name: string, status: string, city: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 150;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(10,16,11,0.9)";
    ctx.beginPath();
    ctx.roundRect(6, 6, 548, 138, 24);
    ctx.fill();
    ctx.fillStyle = "#8fe04a";
    ctx.beginPath();
    ctx.arc(38, 48, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f8ef";
    ctx.font = "700 34px Sora, Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 58, 48);
    ctx.fillStyle = "#9fe86a";
    ctx.font = "600 24px Inter, sans-serif";
    ctx.fillText(status, 24, 96);
    ctx.fillStyle = "rgba(244,248,239,0.6)";
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText(`Destino · ${city}`, 24, 126);
    const texture = track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(9, 2.4, 1);
    sprite.position.set(0, 7.4, -2);
    return sprite;
  }

  const fleetStatus = [
    ["PEDIDO #4822 · EM ROTA", "Curitiba"],
    ["PEDIDO #4823 · INDO PARA O CLIENTE", "São Paulo"],
    ["PEDIDO #4824 · COLETANDO", "Joinville"],
  ];

  const roadFleet = ["GT-2201", "GT-8834"].map((name, index) => {
    const vehicle = makeSimpleTruck(name);
    const dir = index % 2 === 0 ? -1 : 1;
    vehicle.rotation.y = Math.PI;
    vehicle.scale.setScalar(0.94);
    vehicle.position.set(3.6, 0, 0);
    vehicle.add(makeStatusTag(name, fleetStatus[index][0], fleetStatus[index][1]));
    scene.add(vehicle);
    return { mesh: vehicle, lane: 3.6, speed: 7 + index * 2, offset: index * 46, dir };
  });

  // ---------------------------------------------------------------- CD do cliente
  const clientDc = new THREE.Group();
  clientDc.position.set(52, 0, -64);
  scene.add(clientDc);

  const dcDoorX = [-30, -18, -6, 6, 18, 30];

  const dcBody = new THREE.Mesh(round(76, 12, 22, 0.6, 3), wallMat);
  dcBody.position.y = 6;
  clientDc.add(dcBody);

  const dcRoof = new THREE.Mesh(round(77.6, 0.6, 23.6, 0.3, 2), roofMat);
  dcRoof.position.y = 12.2;
  clientDc.add(dcRoof);

  const dcPlinth = new THREE.Mesh(round(76.6, 0.8, 22.6, 0.2, 2), trimMat);
  dcPlinth.position.y = 0.4;
  clientDc.add(dcPlinth);

  // faixa de vidro e letreiro
  const dcGlassBand = new THREE.Mesh(
    round(74, 5.2, 0.4, 0.1, 2),
    new THREE.MeshStandardMaterial({ color: 0x4a5c50, roughness: 0.28, metalness: 0.45 }),
  );
  dcGlassBand.position.set(0, 9, 11.15);
  clientDc.add(dcGlassBand);
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0xf2f5ee, roughness: 0.5, metalness: 0.2 });
  for (let i = 0; i <= 12; i += 1) {
    const mullion = new THREE.Mesh(round(0.28, 5.3, 0.5, 0.04, 1), mullionMat);
    mullion.position.set(-37 + i * (74 / 12), 9, 11.28);
    clientDc.add(mullion);
  }
  [-1, 1].forEach((dir) => {
    const rail = new THREE.Mesh(round(74.4, 0.3, 0.55, 0.06, 1), mullionMat);
    rail.position.set(0, 9 + dir * 2.72, 11.3);
    clientDc.add(rail);
  });

  const dcSignCanvas = document.createElement("canvas");
  dcSignCanvas.width = 2048;
  dcSignCanvas.height = 384;
  const dcSignCtx = dcSignCanvas.getContext("2d")!;
  dcSignCtx.clearRect(0, 0, 2048, 384);
  dcSignCtx.fillStyle = "#f6faf2";
  dcSignCtx.font = "700 150px Sora, Inter, sans-serif";
  dcSignCtx.textBaseline = "middle";
  dcSignCtx.textAlign = "center";
  dcSignCtx.fillText("MATSUYAMA", 1024, 140);
  dcSignCtx.fillStyle = "#8fe04a";
  dcSignCtx.font = "600 52px Inter, sans-serif";
  dcSignCtx.fillText("CENTRO DE DISTRIBUIÇÃO · getTMS", 1024, 270);
  const dcSignTexture = track(new THREE.CanvasTexture(dcSignCanvas));
  dcSignTexture.colorSpace = THREE.SRGBColorSpace;
  const dcSign = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 7.5),
    new THREE.MeshBasicMaterial({ map: dcSignTexture, transparent: true }),
  );
  dcSign.position.set(0, 9, 11.4);
  clientDc.add(dcSign);

  // cobertura contínua das docas
  const dcCanopy = new THREE.Mesh(round(72, 0.25, 4.4, 0.1, 2), concreteMat);
  dcCanopy.position.set(0, 6.9, 13.4);
  clientDc.add(dcCanopy);
  const dcCanopyEdge = new THREE.Mesh(new THREE.BoxGeometry(72, 0.12, 0.16), stripMat);
  const hvacMat = new THREE.MeshStandardMaterial({ color: 0xc9d2c6, roughness: 0.6, metalness: 0.4 });
  [-22, -8, 6, 20].forEach((x) => {
    const unit = new THREE.Mesh(round(4.4, 0.9, 2.6, 0.15, 2), hvacMat);
    unit.position.set(x, 12.8, -1);
    clientDc.add(unit);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0x3a463c, roughness: 0.5, metalness: 0.5 }));
    fan.position.set(x, 13.3, -1);
    clientDc.add(fan);
  });
  for (let i = 0; i < 12; i += 1) {
    const fin = new THREE.Mesh(round(0.14, 6, 0.5, 0.05, 1), trimMat);
    fin.position.set(-36 + i * 6.6, 8.2, 11.2);
    clientDc.add(fin);
  }
  const facadeBand = new THREE.Mesh(
    new THREE.BoxGeometry(76, 0.18, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xf2ffe0 }),
  );
  facadeBand.position.set(0, 6.4, 11.25);
  clientDc.add(facadeBand);

  const dcRoofLed = new THREE.Mesh(new THREE.BoxGeometry(76.4, 0.1, 0.12), new THREE.MeshBasicMaterial({ color: BRAND }));
  dcRoofLed.position.set(0, 12.5, 11.7);
  clientDc.add(dcRoofLed);
  dcCanopyEdge.position.set(0, 6.8, 15.6);
  clientDc.add(dcCanopyEdge);
  for (let i = 0; i < 8; i += 1) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.6, 8), poleMat);
    column.position.set(-32 + i * 8, 3.3, 16);
    clientDc.add(column);
  }

  // 6 portas de doca
  const dcDoorMaterials: THREE.MeshBasicMaterial[] = [];
  const dcDoorMeshes: THREE.Mesh[] = [];
  dcDoorX.forEach((x) => {
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0 });
    dcDoorMaterials.push(doorMat);
    const door = new THREE.Mesh(round(5.2, 5.2, 0.22, 0.08, 2), doorMat);
    door.position.set(x, 2.8, 11.1);
    dcDoorMeshes.push(door);
    clientDc.add(door);
    const lintel = new THREE.Mesh(round(5.8, 0.5, 1, 0.12, 2), trimMat);
    lintel.position.set(x, 5.7, 11.25);
    clientDc.add(lintel);
    const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1, 10), trimMat);
    bumper.rotation.x = Math.PI / 2;
    bumper.position.set(x - 1.6, 1, 11.4);
    clientDc.add(bumper);
    const bumper2 = bumper.clone();
    bumper2.position.x = x + 1.6;
    clientDc.add(bumper2);
  });

  // unidades no telhado
  [-20, -8, 8, 20].forEach((x) => {
    const unit = new THREE.Mesh(round(3.2, 1.1, 2.6, 0.2, 2), unitMat);
    unit.position.set(x, 13, -4);
    clientDc.add(unit);
  });

  const whDockGlow = new THREE.PointLight(0xffe2b8, 25, 40, 2);
  whDockGlow.position.set(-11, 5, 6);
  scene.add(whDockGlow);

  const dcLight = new THREE.PointLight(0xffd9a0, 45, 60, 2);
  dcLight.position.set(0, 6, 18);
  clientDc.add(dcLight);

  // pátio de estacionamento em frente
  const lotBase = new THREE.Mesh(
    round(88, 0.2, 22, 0.3, 2),
    new THREE.MeshStandardMaterial({ color: 0xe6ecdf, roughness: 0.9 }),
  );
  lotBase.position.set(0, 0.04, 27);
  clientDc.add(lotBase);

  const lot = new THREE.Mesh(
    round(84, 0.1, 18.5, 0.2, 2),
    new THREE.MeshStandardMaterial({ color: 0x39443a, roughness: 0.92, metalness: 0.05 }),
  );
  lot.position.set(0, 0.12, 27);
  clientDc.add(lot);

  const bayMat = new THREE.MeshBasicMaterial({ color: 0xe8f2df, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 11; i += 1) {
    const bay = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 5.6), bayMat);
    bay.position.set(-40 + i * 8, 0.19, 30.5);
    clientDc.add(bay);
  }
  const bayBar = new THREE.Mesh(new THREE.BoxGeometry(80, 0.02, 0.16), bayMat);
  bayBar.position.set(0, 0.19, 33.3);
  clientDc.add(bayBar);

  // canteiro central
  const carLot = new THREE.Mesh(
    round(46, 0.08, 14, 0.3, 1),
    new THREE.MeshStandardMaterial({ color: 0x2f3830, roughness: 0.95 }),
  );
  carLot.position.set(-92, 0.08, 26);
  clientDc.add(carLot);
  const island = new THREE.Mesh(
    round(34, 0.5, 3, 0.2, 2),
    new THREE.MeshStandardMaterial({ color: 0xdfe8d4, roughness: 0.9 }),
  );
  island.position.set(0, 0.25, 22.5);
  clientDc.add(island);


  // portaria e cancela na entrada do pátio
  const gatehouse = new THREE.Mesh(round(4, 2.8, 3.4, 0.25, 2), wallMat);
  gatehouse.position.set(-44, 1.4, 19);
  clientDc.add(gatehouse);
  const gateRoof = new THREE.Mesh(round(4.8, 0.3, 4.2, 0.1, 2), roofMat);
  gateRoof.position.set(-44, 2.95, 19);
  clientDc.add(gateRoof);
  const gateWindow = new THREE.Mesh(round(2.6, 1, 0.12, 0.06, 2), new THREE.MeshStandardMaterial({ color: 0x223029, roughness: 0.2, metalness: 0.8 }));
  gateWindow.position.set(-44, 1.8, 20.72);
  clientDc.add(gateWindow);
  const barrierPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 8), trimMat);
  barrierPost.position.set(-41, 0.65, 21);
  clientDc.add(barrierPost);
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  barrier.position.set(-38, 1.25, 21);
  clientDc.add(barrier);
  const barrierStripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.15), new THREE.MeshBasicMaterial({ color: 0x63b32e }));
  barrierStripe.position.set(-39.5, 1.25, 21);
  clientDc.add(barrierStripe);
  const barrierStripe2 = barrierStripe.clone();
  barrierStripe2.position.x = -36.5;
  clientDc.add(barrierStripe2);

  // setas e travas de roda nas vagas
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xe8f2df, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 4; i += 1) {
    const arrow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.16), arrowMat);
    arrow.position.set(-20 + i * 13, 0.2, 25.5);
    clientDc.add(arrow);
  }
  for (let i = 0; i < 8; i += 1) {
    const stop = new THREE.Mesh(round(1.6, 0.18, 0.4, 0.06, 1), concreteMat);
    stop.position.set(-36 + i * 8, 0.24, 33.6);
    clientDc.add(stop);
  }

  // postes do pátio
  [-38, -14, 14, 38].forEach((x) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), poleMat);
    pole.position.set(x, 3.5, 37);
    clientDc.add(pole);
    const head = new THREE.Mesh(round(1.4, 0.16, 0.5, 0.06, 1), new THREE.MeshBasicMaterial({ color: 0xf4ffe0 }));
    head.position.set(x, 7, 36.4);
    clientDc.add(head);
  });

  // carros estacionados
  const parkedColors = [0xffffff, 0x2f3a34, 0x63b32e, 0xd9e2d2];
  parkedColors.forEach((color, index) => {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.65 });
    const body = new THREE.Mesh(round(1.95, 0.72, 4.3, 0.3, 3), bodyMat);
    body.position.y = 0.66;
    const cabin = new THREE.Mesh(round(1.72, 0.62, 2.2, 0.28, 3), glassMat);
    cabin.position.set(0, 1.2, -0.1);
    const roof = new THREE.Mesh(round(1.5, 0.1, 1.9, 0.2, 2), bodyMat);
    roof.position.set(0, 1.5, -0.15);
    const head1 = new THREE.Mesh(round(0.5, 0.16, 0.08, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xf6ffe8 }));
    head1.position.set(0.62, 0.72, 2.14);
    const head2 = head1.clone();
    head2.position.x = -0.62;
    const tail1 = new THREE.Mesh(round(0.44, 0.14, 0.08, 0.04, 1), new THREE.MeshBasicMaterial({ color: 0xff4a3a }));
    tail1.position.set(0.66, 0.78, -2.14);
    const tail2 = tail1.clone();
    tail2.position.x = -0.66;
    car.add(body, cabin, roof, head1, head2, tail1, tail2);
    const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    wg.rotateZ(Math.PI / 2);
    [
      [0.95, 1.35],
      [-0.95, 1.35],
      [0.95, -1.35],
      [-0.95, -1.35],
    ].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wg, tireMat);
      wheel.position.set(x, 0.36, z);
      car.add(wheel);
    });
    car.position.set(-96 + index * 9, 0.18, 26);
    car.rotation.y = index % 2 === 0 ? 0 : Math.PI;
    car.scale.setScalar(0.001);
    car.userData.delay = 0.02 * index;
    clientDc.add(car);
    parkedCars.push(car);
  });

  // pátio de contêineres ao lado do CD
  const yardGroup = new THREE.Group();
  yardGroup.position.set(150, 0, -46);
  clientDc.add(yardGroup);

  const yardPad = new THREE.Mesh(
    round(62, 0.12, 44, 0.3, 2),
    new THREE.MeshStandardMaterial({ color: 0x2b332c, roughness: 0.95 }),
  );
  yardPad.position.set(0, 0.1, 4);
  yardGroup.add(yardPad);

  const containerColors = [0x63b32e, 0x2f6f4f, 0xdbe3d2, 0xf2f5ee, 0x8aa86f, 0xc4552f];
  const containerGeo = round(6.1, 2.6, 2.5, 0.08, 1);
  const containerMats = containerColors.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 }),
  );
  const stackSlots: [number, number, number][] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const height = col === 1 ? 2 : col === 3 ? 2 : 1;
      for (let level = 0; level < height; level += 1) {
        const mat = containerMats[(row * 3 + col + level) % containerMats.length];
        const box = new THREE.Mesh(containerGeo, mat);
        box.position.set(-11 + row * 7.4, 1.4 + level * 2.62, -6 + col * 3);
        yardGroup.add(box);
        stackSlots.push([box.position.x, box.position.y, box.position.z]);
      }
    }
  }

  // empilhadeira com contêiner na garra
  const yardLift = new THREE.Group();
  const yardLiftBody = new THREE.Mesh(round(3.4, 1.8, 1.9, 0.25, 2), new THREE.MeshStandardMaterial({ color: 0xe8b02a, roughness: 0.5, metalness: 0.4 }));
  yardLiftBody.position.y = 1.5;
  yardLift.add(yardLiftBody);
  const yardLiftCabin = new THREE.Mesh(round(1.5, 1.5, 1.7, 0.25, 2), glassMat);
  yardLiftCabin.position.set(-0.7, 2.9, 0);
  yardLift.add(yardLiftCabin);
  const yardLiftMast = new THREE.Mesh(round(0.3, 5.4, 0.3, 0.08, 1), new THREE.MeshStandardMaterial({ color: 0x39443a, roughness: 0.5, metalness: 0.6 }));
  yardLiftMast.position.set(1.9, 3, 0);
  yardLift.add(yardLiftMast);
  const yardLiftLoad = new THREE.Mesh(containerGeo, containerMats[2]);
  yardLiftLoad.position.set(3.4, 4.4, 0);
  yardLift.add(yardLiftLoad);
  const yardLiftWheel = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10);
  yardLiftWheel.rotateZ(Math.PI / 2);
  [
    [1.1, 0.95],
    [1.1, -0.95],
    [-1.1, 0.95],
    [-1.1, -0.95],
  ].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(yardLiftWheel, tireMat);
    wheel.position.set(x, 0.6, z);
    yardLift.add(wheel);
  });
  queueGlb({ key: "forklift", holder: yardLift, parts: [...yardLift.children], length: 3.6, rotY: Math.PI / 2 });
  yardLift.position.set(6, 0, -43.4);
  yardLift.rotation.y = Math.PI * 0.5;
  clientDc.add(yardLift);

  // torre de controle / escritório de análise
  const office = new THREE.Group();
  office.position.set(0, 12.4, -2);
  clientDc.add(office);

  const officeShell = new THREE.Mesh(round(28, 8.5, 8, 0.4, 3), wallMat);
  officeShell.position.set(0, 4.25, -2);
  office.add(officeShell);

  const officeRoof = new THREE.Mesh(round(29.4, 0.5, 13.4, 0.25, 2), roofMat);
  officeRoof.position.set(0, 8.6, -0.6);
  office.add(officeRoof);

  const officeInterior = new THREE.Mesh(
    round(27, 7.2, 0.14, 0.05, 1),
    new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.85 }),
  );
  officeInterior.position.set(0, 4.1, 2.1);
  office.add(officeInterior);

  const officeGlassMat = new THREE.MeshStandardMaterial({
    color: 0xcfe6ee,
    roughness: 0.06,
    metalness: 0.9,
    transparent: true,
    opacity: 0.14,
  });
  const officeGlass = new THREE.Mesh(round(27.2, 7.4, 0.2, 0.1, 2), officeGlassMat);
  officeGlass.position.set(0, 4.2, 7.4);
  office.add(officeGlass);

  const officeFloor = new THREE.Mesh(round(27, 0.2, 11.6, 0.05, 1), new THREE.MeshStandardMaterial({ color: 0xb9c4b4, roughness: 0.75 }));
  officeFloor.position.set(0, 0.6, 3.2);
  office.add(officeFloor);

  const heroTextures = [0, 1, 2, 3].map((kind) =>
    track(new THREE.CanvasTexture(makeFeatureScreen(kind))),
  );
  heroTextures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  });
  const heroMat = new THREE.MeshBasicMaterial({ map: heroTextures[0], transparent: true });
  const heroTable = new THREE.Mesh(round(3.2, 2, 0.12, 0.06, 2), heroMat);
  heroTable.position.set(0, 3.2, 6.75);
  office.add(heroTable);
  const heroBezel = new THREE.Mesh(round(3.4, 2.2, 0.08, 0.05, 2), new THREE.MeshStandardMaterial({ color: 0x1a211c, roughness: 0.5 }));
  heroBezel.position.set(0, 3.2, 6.68);
  office.add(heroBezel);
  let heroView: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  const monitorMats: THREE.MeshBasicMaterial[] = [];
  const screenTextures = [0, 1, 2].map((kind) => track(makeScreenTexture(kind)));
  const deskMat = new THREE.MeshStandardMaterial({ color: 0xeef2e8, roughness: 0.5, metalness: 0.1 });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2f3c33, roughness: 0.7 });
  const shirtMats = [
    new THREE.MeshStandardMaterial({ color: 0x5b6f60, roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ color: 0x40564a, roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ color: 0x7d8f80, roughness: 0.75 }),
  ];

  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const x = -9 + col * 3;
      const y = 2.5 + row * 3.3;

      const screenMat = new THREE.MeshBasicMaterial({
        map: screenTextures[(row * 7 + col) % 3],
        transparent: true,
        opacity: 0,
      });
      monitorMats.push(screenMat);
      const monitor = new THREE.Mesh(round(2, 1.25, 0.12, 0.05, 2), screenMat);
      monitor.position.set(x, y + 0.7, 6.55);
      office.add(monitor);

      const bezel = new THREE.Mesh(round(2.14, 1.38, 0.06, 0.04, 2), new THREE.MeshStandardMaterial({ color: 0x1a211c, roughness: 0.5 }));
      bezel.position.set(x, y + 0.7, 6.5);
      office.add(bezel);

      const deskTop = new THREE.Mesh(round(2.7, 0.1, 1.5, 0.05, 2), deskMat);
      deskTop.position.set(x, y - 0.15, 6.1);
      office.add(deskTop);

      const keyboard = new THREE.Mesh(round(1.1, 0.05, 0.36, 0.02, 1), new THREE.MeshStandardMaterial({ color: 0x2a332c, roughness: 0.6 }));
      keyboard.position.set(x, y - 0.08, 6.55);
      office.add(keyboard);

      const chairBack = new THREE.Mesh(round(0.95, 1.15, 0.16, 0.1, 2), chairMat);
      chairBack.position.set(x, y + 0.35, 4.55);
      office.add(chairBack);

      const chairSeat = new THREE.Mesh(round(0.95, 0.16, 0.9, 0.06, 2), chairMat);
      chairSeat.position.set(x, y - 0.2, 4.95);
      office.add(chairSeat);

      // mantém a mesa do destaque livre para a câmera do escritório
      if (!(row === 0 && (col === 2 || col === 4))) {
        const analyst = new THREE.Mesh(round(0.66, 0.95, 0.5, 0.24, 2), shirtMats[(row + col) % 3]);
        analyst.position.set(x, y + 0.15, 5.05);
        office.add(analyst);

        const analystHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skinMats[(row * 7 + col) % skinMats.length]);
        analystHead.position.set(x, y + 0.82, 5.05);
        office.add(analystHead);
      }
    }
  }

  // video wall no fundo
  for (let i = 0; i < 3; i += 1) {
    const wallMatScreen = new THREE.MeshBasicMaterial({ map: screenTextures[i], transparent: true, opacity: 0 });
    monitorMats.push(wallMatScreen);
    const wallScreen = new THREE.Mesh(round(7.4, 3.4, 0.1, 0.06, 2), wallMatScreen);
    wallScreen.position.set(-9 + i * 9, 5.6, 2.22);
    office.add(wallScreen);
  }

  // volume superior recuado, terraço, coroa e detalhes
  const officeTerrace = new THREE.Mesh(round(28.8, 0.4, 13.4, 0.2, 2), roofMat);
  officeTerrace.position.set(0, 8.95, -1);
  office.add(officeTerrace);

  const officeUpper = new THREE.Mesh(round(20, 4.2, 9.4, 0.5, 3), wallMat);
  officeUpper.position.set(0, 11.2, -2.6);
  office.add(officeUpper);

  const upperGlass = new THREE.Mesh(
    round(18, 2.4, 0.2, 0.1, 2),
    new THREE.MeshStandardMaterial({ color: 0x1b2620, roughness: 0.15, metalness: 0.8, emissive: 0x14251a, emissiveIntensity: 0.6 }),
  );
  upperGlass.position.set(0, 11.4, 2.2);
  office.add(upperGlass);

  const officeCrown = new THREE.Mesh(round(21.4, 0.4, 10.4, 0.25, 2), roofMat);
  officeCrown.position.set(0, 13.5, -2.6);
  office.add(officeCrown);

  const ledMat = new THREE.MeshBasicMaterial({ color: BRAND });
  [
    [28.9, 0.09, 0.12, 0, 9.18, 5.6],
    [21.5, 0.09, 0.12, 0, 13.72, 2.5],
    [0.12, 0.09, 13.5, -14.4, 9.18, -1],
    [0.12, 0.09, 13.5, 14.4, 9.18, -1],
    [0.12, 8.4, 0.12, -14, 4.2, 5.9],
    [0.12, 8.4, 0.12, 14, 4.2, 5.9],
  ].forEach(([w, h, d, x, y, z]) => {
    const led = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ledMat);
    led.position.set(x, y, z);
    office.add(led);
  });

  // brises horizontais na fachada
  for (let i = 0; i < 3; i += 1) {
    const band = new THREE.Mesh(round(27.6, 0.16, 0.5, 0.06, 1), trimMat);
    band.position.set(0, 1.4 + i * 2.6, 6.5);
    office.add(band);
  }

  // jardim no terraço
  for (let i = 0; i < 5; i += 1) {
    const planter = new THREE.Mesh(round(1.8, 0.5, 1.2, 0.2, 2), concreteMat);
    planter.position.set(-11 + i * 5.5, 9.3, 5);
    office.add(planter);
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), leafMat);
    shrub.position.set(-11 + i * 5.5, 10.1, 5);
    shrub.scale.set(1.1, 0.75, 1);
    office.add(shrub);
  }

  const officeLight = new THREE.PointLight(0xfff3dd, 30, 36, 2);
  officeLight.position.set(0, 7.4, 4.4);
  office.add(officeLight);

  // fluxo de dados das docas para o escritório
  const dataFlows: { curve: THREE.CatmullRomCurve3; tube: THREE.Mesh; speed: number }[] = [];
  [-20, 0, 20].forEach((x, index) => {
    const flowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 6.6, 16),
      new THREE.Vector3(x * 0.8, 10.5, 14),
      new THREE.Vector3(x * 0.5, 14.5, 8),
      new THREE.Vector3(x * 0.2, 17, 5),
      new THREE.Vector3(0, 18.2, 4.2),
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(flowCurve, 90, 0.055, 6, false),
      new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0 }),
    );
    clientDc.add(tube);
    dataFlows.push({ curve: flowCurve, tube, speed: 0.35 + index * 0.08 });
  });

  const flowDots = [0, 1, 2].map(() => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xeaffd2, transparent: true, opacity: 0 }),
    );
    clientDc.add(dot);
    return dot;
  });

  clientDc.scale.y = 0.001;

  // frota getTMS estacionada nas 6 docas
  const dcTrucks: THREE.Group[] = [];
  const fleetNames = ["GT-4821", "GT-1937", "GT-7712", "GT-3048", "GT-6620", "GT-9155"];
  // via de serviço conectando as docas à avenida
  const serviceRoad = new THREE.Mesh(new THREE.PlaneGeometry(9, 86), roadMat);
  serviceRoad.rotation.x = -Math.PI / 2;
  serviceRoad.position.set(0, 0.05, 60);
  clientDc.add(serviceRoad);
  for (let i = 0; i < 12; i += 1) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 2.8), dashMat);
    dash.position.set(0, 0.08, 22 + i * 6.4);
    clientDc.add(dash);
  }
  [-4.4, 4.4].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 86), edgeMat);
    edge.position.set(side, 0.08, 60);
    clientDc.add(edge);
  });
  dcDoorX.forEach((doorX, index) => {
    if (index === 3) return;
    const parked = makeSimpleTruck(fleetNames[index]);
    parked.position.set(doorX, 0, 19.5);
    parked.rotation.y = Math.PI / 2;
    parked.scale.setScalar(0.001);
    parked.userData.delay = index * 0.015;
    parked.userData.dockX = doorX;
    const orderCanvas = document.createElement("canvas");
    orderCanvas.width = 640;
    orderCanvas.height = 160;
    const orderCtx = orderCanvas.getContext("2d")!;
    orderCtx.fillStyle = "rgba(10,16,11,0.94)";
    orderCtx.beginPath();
    orderCtx.roundRect(6, 6, 628, 148, 26);
    orderCtx.fill();
    orderCtx.fillStyle = "#8fe04a";
    orderCtx.beginPath();
    orderCtx.arc(44, 52, 11, 0, Math.PI * 2);
    orderCtx.fill();
    orderCtx.fillStyle = "#f4f8ef";
    orderCtx.font = "700 38px Sora, Inter, sans-serif";
    orderCtx.textBaseline = "middle";
    orderCtx.fillText("PEDIDO #" + (4820 + index * 37), 70, 52);
    orderCtx.fillStyle = "#9fe86a";
    orderCtx.font = "600 28px Inter, sans-serif";
    orderCtx.fillText("CARREGANDO · CD GETTMS", 44, 112);
    const orderTex = track(new THREE.CanvasTexture(orderCanvas));
    orderTex.colorSpace = THREE.SRGBColorSpace;
    const orderTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: orderTex, transparent: true, depthWrite: false }));
    orderTag.scale.set(11, 2.75, 1);
    orderTag.position.set(0, 9.6, 0);
    orderTag.visible = false;
    parked.add(orderTag);
    parked.userData.orderTag = orderTag;
    clientDc.add(parked);
    dcTrucks.push(parked);
  });

  // ---------------------------------------------------------------- nós da rota
  type Node = { group: THREE.Group; ring: THREE.Mesh; beam: THREE.Mesh; delay: number };
  const nodes: Node[] = [];

  ROUTE_POINTS.forEach(([x, , z], index) => {
    if (index === 0) return;
    const group = new THREE.Group();
    group.position.set(x, 0.32, z);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.95, 56),
      new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0xecffd6, transparent: true, opacity: 0.95 }),
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.02;
    group.add(core);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.32, 16, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = 8;
    group.add(beam);

    group.scale.setScalar(0.001);
    scene.add(group);
    nodes.push({ group, ring, beam, delay: index * 0.035 });
  });

  // ---------------------------------------------------------------- rota
  const curve = new THREE.CatmullRomCurve3(
    ROUTE_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const tubeGeo = new THREE.TubeGeometry(curve, 320, 0.14, 8, false);
  const routeLine = new THREE.Mesh(
    tubeGeo,
    new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 1 }),
  );
  routeLine.geometry.setDrawRange(0, 0);
  scene.add(routeLine);

  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xf2ffdd }),
  );
  pulse.visible = false;
  scene.add(pulse);

  const pulseGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 18, 18),
    new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  pulse.add(pulseGlow);

  const arrivalRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.7, 64),
    new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  arrivalRing.rotation.x = -Math.PI / 2;
  const lastPoint = ROUTE_POINTS[ROUTE_POINTS.length - 1];
  arrivalRing.position.set(lastPoint[0] + 2, 0.34, lastPoint[2]);
  scene.add(arrivalRing);

  // ---------------------------------------------------------------- partículas
  const particleCount = low ? 220 : 520;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 140;
    positions[i * 3 + 1] = Math.random() * 26;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 220 - 40;
    speeds[i] = 0.4 + Math.random() * 1.5;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      color: 0x5fa832,
      size: 0.16,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  scene.add(particles);

  // ---------------------------------------------------------------- estado
  let target = 0;
  let current = 0;
  let orbitActive = false;
  let orbitAngle = 0.6;
  let orbitRadius = 58;
  let truckPhase = 0;
  let truckSpeed = 0;
  let wheelSpinAcc = 0;
  let lastFrameTime = 0;
  let orbitDrag = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let width = 1;
  let height = 1;
  let frame = 0;
  let disposed = false;
  let elapsed = 0;
  let lastTime = performance.now();

  const lookTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  heroTable.updateWorldMatrix(true, false);
  {
    const worldPos = new THREE.Vector3();
    heroTable.getWorldPosition(worldPos);
    const quat = new THREE.Quaternion();
    heroTable.getWorldQuaternion(quat);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).normalize();
    heroView = {
      pos: worldPos.clone().add(forward.multiplyScalar(4.2)).add(new THREE.Vector3(0, 0.35, 0)),
      look: worldPos.clone(),
    };
  }
  const SEGMENT_VIEWS: Record<string, { pos: THREE.Vector3; look: THREE.Vector3; office?: boolean }> = {
    alimentos: { pos: new THREE.Vector3(-64, 22, -6), look: new THREE.Vector3(-92, 7, -34) },
    farma: { pos: new THREE.Vector3(-44, 22, 58), look: new THREE.Vector3(-72, 7, 30) },
    construcao: { pos: new THREE.Vector3(-90, 22, 38), look: new THREE.Vector3(-118, 7, 8) },
    ecommerce: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    simulacao: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    ocorrencias: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    afericao: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    relatorios: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
  };
  let segmentView: { pos: THREE.Vector3; look: THREE.Vector3; office?: boolean } | null = null;
  const officePos = new THREE.Vector3();
  const officeQuat = new THREE.Quaternion();
  const officeFwd = new THREE.Vector3();
  const officeRight = new THREE.Vector3();
  let segmentZoom = 1;
  const segTarget = new THREE.Vector3();
  const overrideLook = new THREE.Vector3();

  function sampleCamera(p: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
    let i = 0;
    while (i < CAMERA_KEYS.length - 2 && p > CAMERA_KEYS[i + 1].t) i += 1;
    const a = CAMERA_KEYS[i];
    const b = CAMERA_KEYS[i + 1];
    const raw = clamp01((p - a.t) / (b.t - a.t));
    const t = easeInOut(raw);
    outPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
    outLook.set(
      lerp(a.look[0], b.look[0], t),
      lerp(a.look[1], b.look[1], t),
      lerp(a.look[2], b.look[2], t),
    );
  }

  function applyProgress(p: number, time: number) {
    const frameDt = Math.min(0.05, Math.max(0.001, time - lastFrameTime));
    lastFrameTime = time;
    const pb = Math.max(0.86, p);
    groundUniforms.uProgress.value = easeOut(range(pb, 0.0, 0.22));

    const roadReveal = easeOut(range(pb, 0.0, 0.1));
    asphaltMat.opacity = roadReveal;
    curbMat.opacity = roadReveal;
    edgeMat.opacity = roadReveal * 0.5;
    dashMat.opacity = roadReveal * 0.85;
    gridRoadMat.opacity = roadReveal * 0.9;
    yardGroup.visible = p > 0.8;

    const treesIn = easeOut(range(pb, 0.06, 0.22));
    treeGroup.scale.y = Math.max(0.001, treesIn);

    nodes.forEach((node) => {
      const t = easeOut(range(pb, 0.48 + node.delay, 0.6 + node.delay));
      node.group.scale.setScalar(Math.max(0.001, t));
      const breathe = 0.55 + Math.sin(time * 2 + node.delay * 14) * 0.25;
      (node.ring.material as THREE.MeshBasicMaterial).opacity = t * breathe;
      (node.beam.material as THREE.MeshBasicMaterial).opacity = t * 0.14;
    });

    // caminhão: aproxima, estaciona na doca e depois parte
    const enter = easeInOut(range(pb, 0.05, 0.24));
    const drive = easeInOut(range(pb, 0.62, 0.78));
    const swing = easeInOut(range(pb, 0.78, 0.85));
    const reverse = easeInOut(range(pb, 0.85, 0.92));

    // velocidade com aceleração e frenagem nas docas
    const dockBell = Math.exp(-Math.pow((truckPhase - 0.62) / 0.09, 2));
    const speedTarget = 0.017 * (1 - 0.72 * dockBell);
    const accel = (speedTarget - truckSpeed) * Math.min(1, frameDt * 2.2);
    truckSpeed += accel;
    truckPhase = (truckPhase + truckSpeed * frameDt) % 1;
    const loopT = truckPhase;
    const truckPoint = truckPath.getPointAt(loopT);
    const truckTangent = truckPath.getTangentAt(loopT);
    truck.position.set(truckPoint.x, 0, truckPoint.z);
    truck.rotation.y = Math.atan2(truckTangent.x, truckTangent.z);
    truck.rotation.z = THREE.MathUtils.clamp(accel * 6, -0.02, 0.02);
    truck.rotation.x = -Math.abs(accel) * 1.2;
    truck.visible = true;
    wheelSpinAcc += truckSpeed * frameDt * 520;
    wheels.forEach((wheel) => {
      wheel.rotation.x = wheelSpinAcc;
    });

    visitors.forEach((item) => {
      const cycle = (time * 0.05 + item.phase) % 1;
      const inbound = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
      const eased = inbound * inbound * (3 - 2 * inbound);
      item.mesh.position.z = lerp(48, 14, eased);
      item.mesh.position.x = 0;
      item.mesh.rotation.y = cycle < 0.5 ? 0 : Math.PI;
    });

    roadFleet.forEach((item) => {
      const span = 112;
      const travelled = (time * item.speed + item.offset) % span;
      // o tráfego da via sai antes do acesso ao CD (não cruza o cruzamento)
      item.mesh.position.z = 70 - travelled;
      item.mesh.position.x = item.lane;
    });

    const forkCycle = (time * 0.16) % 2;
    const forkPhase = forkCycle < 1 ? forkCycle : 2 - forkCycle;
    const forkEase = forkPhase * forkPhase * (3 - 2 * forkPhase);
    // descarga: da doca do caminhão até a porta do CD e volta
    yardLift.position.x = lerp(6, 26, forkEase);
    yardLift.position.z = -43.4;
    yardLift.rotation.y = forkCycle < 1 ? Math.PI * 0.5 : -Math.PI * 0.5;
    yardLiftLoad.visible = forkCycle < 1;
    yardLiftLoad.position.y = 4.4 + Math.sin(forkEase * Math.PI) * 0.25;
    yardLiftLoad.position.y = 4.4 + Math.sin(forkEase * Math.PI) * 0.35;
    yardLift.visible = p > 0.66;

    // furgão no sentido oposto, em loop
    const vanTravel = (time * 0.06 + p * 0.4) % 1;
    van.position.z = lerp(-118, 46, vanTravel);
    van.visible = p > 0.08;

    // armazém
    const rise = easeOut(range(pb, 0.12, 0.28));
    warehouse.scale.y = Math.max(0.001, rise);
    doorMaterials.forEach((material) => {
      material.opacity = Math.min(1, rise * 1.1);
    });
    dockLight.intensity = 40 * rise;

    const forkliftIn = easeOut(range(pb, 0.2, 0.3)) * (p > 0.18 && p < 0.5 ? 1 : 0);
    forklift.scale.setScalar(Math.max(0.001, forkliftIn));
    forklift.position.z = 4 + Math.sin(time * 0.8) * 0.6;

    palletGroup.children.forEach((pallet, index) => {
      const t = easeOut(range(pb, 0.22 + index * 0.03, 0.3 + index * 0.03));
      pallet.scale.setScalar(Math.max(0.001, t));
    });

    // contêineres
    crates.forEach((crate) => {
      const t = easeOut(range(pb, 0.2 + crate.delay, 0.3 + crate.delay));
      crate.mesh.scale.setScalar(Math.max(0.001, t));
      crate.mesh.position.y = lerp(crate.baseY + 10, crate.baseY, t);
      crate.mesh.rotation.y = crate.spin * (1 - t);
    });

    // viaduto
    const bridgeIn = easeOut(range(pb, 0.4, 0.52));

    // cidade
    towers.forEach((tower) => {
      const t = easeOut(range(pb, 0.4 + tower.delay, 0.54 + tower.delay));
      tower.mesh.scale.y = Math.max(0.001, t);
      tower.mesh.position.y = (tower.height / 2) * t;
      const cap = tower.mesh.userData.cap as THREE.Mesh | undefined;
      if (cap) {
        cap.scale.y = Math.max(0.001, t);
        cap.position.y = tower.height * t + 0.3;
      }
    });

    // hub de entrega
    const hubIn = easeOut(range(pb, 0.74, 0.86));
    hub.scale.y = Math.max(0.001, hubIn) * 1.15;
    parcels.children.forEach((parcel, index) => {
      const t = easeOut(range(pb, 0.84 + index * 0.03, 0.92 + index * 0.03));
      parcel.scale.setScalar(Math.max(0.001, t));
    });

    // pessoas
    people.forEach((person, index) => {
      const t = easeOut(range(pb, 0.1 + person.delay, 0.2 + person.delay));
      person.group.scale.setScalar(Math.max(0.001, t * 1.12));
      const speed = person.walkAxis ? 1.4 : 0.7;
      const swing = Math.sin(time * speed + person.phase) * (person.walkAxis ? 0.55 : 0.12);
      person.legL.rotation.x = swing;
      person.legR.rotation.x = -swing;
      person.armL.rotation.x = -swing * 0.8;
      person.armR.rotation.x = swing * 0.8;
      person.group.position.y = Math.abs(Math.sin(time * speed + person.phase)) * (person.walkAxis ? 0.06 : 0.02);
      if (person.walkAxis) {
        const travel = Math.sin(time * 0.22 + person.phase) * person.walkRange;
        if (person.walkAxis === "z") person.group.position.z = person.base.z + travel;
        else person.group.position.x = person.base.x + travel;
      }
      person.group.visible = index < 6 ? p > 0.05 : p > 0.78;
    });

    // carros
    cars.forEach((car) => {
      const t = easeOut(range(pb, 0.08 + car.delay, 0.16 + car.delay));
      car.group.scale.setScalar(Math.max(0.001, t));
      const span = 180;
      const progress = (time * car.speed + car.offset + p * 0.15) % 1;
      const z = car.dir > 0 ? lerp(-130, 50, progress) : lerp(50, -130, progress);
      car.group.position.z = z;
      car.wheels.forEach((wheel) => {
        wheel.rotation.x += car.speed * 40;
      });
      car.group.visible = t > 0.001;
    });

    // drone
    const droneIn = easeOut(range(pb, 0.18, 0.28));
    drone.scale.setScalar(Math.max(0.001, droneIn));
    const orbit = time * 0.35;
    drone.position.set(10 + Math.cos(orbit) * 9, 13 + Math.sin(time * 1.4) * 0.6, -4 + Math.sin(orbit) * 9);
    drone.rotation.y = -orbit;
    rotors.forEach((rotor, index) => {
      rotor.rotation.y = time * (20 + index * 3);
    });
    (droneLed.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(time * 6) > 0 ? 0xff6b5a : 0x5a2a24);

    // antena e anéis de dados
    const antennaIn = easeOut(range(pb, 0.46, 0.58));
    antenna.scale.y = Math.max(0.001, antennaIn);
    (antennaLed.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(time * 3) > 0.2 ? 0xff6b5a : 0x4a2420);
    dataRings.forEach((ring, index) => {
      const t = easeOut(range(pb, 0.5 + index * 0.04, 0.6 + index * 0.04));
      ring.scale.setScalar(Math.max(0.001, t));
      ring.rotation.z = time * (0.12 + index * 0.05);
      (ring.material as THREE.MeshBasicMaterial).opacity = t * (0.2 - index * 0.04) * (0.7 + Math.sin(time * 2 + index) * 0.3);
    });

    // CD do cliente, caminhões na doca e escritório
    const dcIn = easeOut(range(pb, 0.68, 0.8));
    clientDc.scale.y = Math.max(0.001, dcIn);
    dcDoorMaterials.forEach((material) => {
      material.opacity = Math.min(1, dcIn * 1.2) * (0.75 + Math.sin(time * 1.6) * 0.15);
    });
    dcLight.intensity = 35 * dcIn;
    dcTrucks.forEach((clone, index) => {
      const delay = (clone.userData.delay as number) || 0;
      const appear = easeOut(range(pb, 0.72 + delay, 0.78 + delay));
      const side = (index % 2 === 0 ? 1 : -1) as number;
      const dockX = clone.userData.dockX as number;
      // ciclo: entra (4 s) -> carrega 20 s -> sai (5 s) -> aguarda
      const cycle = ((time + index * 6.4) % 31) / 31;
      let approach = 0;
      let docked = 0;
      if (cycle < 0.13) {
        approach = cycle / 0.13;
      } else if (cycle < 0.13 + 0.645) {
        approach = 1;
        docked = 1;
      } else if (cycle < 0.94) {
        approach = 1 - (cycle - 0.775) / 0.165;
      }
      const eased = approach * approach * (3 - 2 * approach);
      const present = appear > 0.5;
      clone.visible = present;
      clone.scale.setScalar(Math.max(0.001, appear * 0.94));
      // desce pela via de serviço e entra na doca em curva, com a traseira para a porta
      const turn = THREE.MathUtils.smoothstep(eased, 0.34, 1);
      const curveX = eased * eased * dockX;
      clone.position.z = lerp(66, 19.5, eased);
      clone.position.x = curveX + Math.sin(eased * Math.PI) * 0.5 * side;
      clone.rotation.y = lerp(Math.PI, Math.PI * 0.5, turn);
      const tag = clone.userData.orderTag as THREE.Sprite | undefined;
      if (tag) tag.visible = docked > 0.5 && cycle < 0.775;
    });
    dcDoorMeshes.forEach((door, index) => {
      const clone = dcTrucks[index === 2 || index === 3 ? (index === 2 ? 2 : 3) : index];
      let open = 0;
      if (clone) {
        const cycle = ((time + index * 6.4) % 31) / 31;
        open = cycle >= 0.13 && cycle < 0.775 ? 1 : 0;
      }
      door.scale.y = 1 - open * 0.94;
      door.position.y = 2.8 + open * 2.45;
    });
    parkedCars.forEach((car) => {
      const delay = (car.userData.delay as number) || 0;
      const t = easeOut(range(pb, 0.76 + delay, 0.84 + delay));
      car.scale.setScalar(Math.max(0.001, t));
    });
    monitorMats.forEach((material, index) => {
      const t = easeOut(range(pb, 0.88 + (index % 5) * 0.012, 0.95 + (index % 5) * 0.012));
      material.opacity = t * (0.88 + Math.sin(time * 2.4 + index) * 0.1);
    });
    dataFlows.forEach((flow, index) => {
      const t = easeOut(range(pb, 0.86 + index * 0.02, 0.94 + index * 0.02));
      (flow.tube.material as THREE.MeshBasicMaterial).opacity = t * 0.35;
      const dot = flowDots[index];
      (dot.material as THREE.MeshBasicMaterial).opacity = t;
      dot.visible = t > 0.01;
      const travel = (time * flow.speed * 0.35 + index * 0.25) % 1;
      flow.curve.getPointAt(travel, dot.position);
    });

    // rota
    const routeT = easeInOut(range(pb, 0.48, 0.82));
    const indexCount = tubeGeo.index ? tubeGeo.index.count : 0;
    routeLine.geometry.setDrawRange(0, Math.floor((indexCount * routeT) / 3) * 3);
    routeLine.visible = routeT > 0.001;
    if (routeT > 0.001 && routeT < 0.999) {
      pulse.visible = true;
      curve.getPointAt(routeT, pulse.position);
      pulse.scale.setScalar(0.85 + Math.sin(time * 6) * 0.15);
    } else {
      pulse.visible = routeT >= 0.999;
      if (pulse.visible) {
        curve.getPointAt(1, pulse.position);
        pulse.scale.setScalar(1 + Math.sin(time * 4) * 0.12);
      }
    }

    const arrival = easeOut(range(pb, 0.88, 1));
    (arrivalRing.material as THREE.MeshBasicMaterial).opacity = arrival * (0.35 + Math.sin(time * 3) * 0.2);
    arrivalRing.scale.setScalar(0.8 + arrival * 0.7 + Math.sin(time * 3) * 0.06);

    const array = particleGeo.getAttribute("position") as THREE.BufferAttribute;
    const data = array.array as Float32Array;
    for (let i = 0; i < particleCount; i += 1) {
      data[i * 3 + 1] += speeds[i] * 0.012;
      if (data[i * 3 + 1] > 28) data[i * 3 + 1] = 0;
    }
    array.needsUpdate = true;
    (particles.material as THREE.PointsMaterial).opacity = 0.25 + 0.35 * range(pb, 0.05, 0.5);
  }

  function render() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.2, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += dt;

    current += (target - current) * Math.min(1, dt * 5);
    smoothX += (pointerX - smoothX) * Math.min(1, dt * 3);
    smoothY += (pointerY - smoothY) * Math.min(1, dt * 3);

    if (orbitActive) {
      orbitAngle += orbitDrag;
      orbitDrag *= 0.85;
      const radius = orbitRadius;
      camPos.set(
        lookTarget.x + Math.sin(orbitAngle) * radius,
        26,
        lookTarget.z + Math.cos(orbitAngle) * radius,
      );
    } else {
      sampleCamera(current, camPos, lookTarget);
    }
    const chapterMids = [0.13, 0.25, 0.37, 0.49, 0.61, 0.705, 0.78, 0.87, 0.94, 1.04];
    let bell = 0;
    chapterMids.forEach((mid) => {
      bell = Math.max(bell, Math.max(0, 1 - Math.abs(current - mid) / 0.065));
    });
    bell = bell * bell * (3 - 2 * bell);
    camPos.sub(lookTarget).multiplyScalar(1 - 0.2 * bell).add(lookTarget);

    const aspect = width / height;
    if (aspect < 1.3) {
      const pull = Math.min(2.05, 1.32 / aspect);
      camPos.sub(lookTarget).multiplyScalar(pull).add(lookTarget);
    }

    camPos.x += smoothX * 2.6;
    camPos.y += smoothY * 1.8;

    camera.position.copy(camPos);
    camera.lookAt(lookTarget);
    if (segmentView) {
      if (segmentView.office) {
        heroTable.getWorldPosition(officePos);
        heroTable.getWorldQuaternion(officeQuat);
        officeFwd.set(0, 0, 1).applyQuaternion(officeQuat).normalize();
        officeRight.set(1, 0, 0).applyQuaternion(officeQuat).normalize();
        segTarget
          .copy(officePos)
          .addScaledVector(officeFwd, 5.9 * segmentZoom)
          .addScaledVector(officeRight, 1.9)
          .add(new THREE.Vector3(0, 0.95, 0));
        overrideLook.lerp(officePos, 0.25);
        camera.position.copy(segTarget);
        camera.lookAt(overrideLook);
      } else {
        segTarget.copy(segmentView.pos).sub(segmentView.look).multiplyScalar(segmentZoom).add(segmentView.look);
        overrideLook.lerp(segmentView.look, 0.05);
        camera.position.lerp(segTarget, 0.12);
        camera.lookAt(overrideLook);
      }
    }

    applyProgress(current, elapsed);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }

  resize();
  frame = requestAnimationFrame(render);


  function makeCabOverSource(): THREE.Group {
    const root = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0xf4f7f0, roughness: 0.35, metalness: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c241e, roughness: 0.5, metalness: 0.4 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4e6, roughness: 0.18, metalness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x2a3a33, roughness: 0.08, metalness: 0.9 });
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
    const rearLamp = new THREE.MeshBasicMaterial({ color: 0xd8352a });
    // chassis
    const chassis = new THREE.Mesh(round(2.2, 0.42, 14.6, 0.08, 1), dark);
    chassis.position.set(0, 0.95, -0.4);
    root.add(chassis);
    // cabine toco
    const cab = new THREE.Mesh(round(2.5, 2.85, 2.35, 0.28, 3), body);
    cab.position.set(0, 2.5, 5.55);
    root.add(cab);
    const roof = new THREE.Mesh(round(2.42, 0.5, 2.3, 0.22, 2), body);
    roof.position.set(0, 4.1, 5.6);
    root.add(roof);
    const deflector = new THREE.Mesh(round(2.4, 0.85, 1.5, 0.4, 2), body);
    deflector.position.set(0, 4.55, 5.25);
    root.add(deflector);
    // para-brisa inclinado
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.45, 0.1), glass);
    windshield.position.set(0, 3.32, 6.74);
    windshield.rotation.x = -0.12;
    root.add(windshield);
    [-1.26, 1.26].forEach((x) => {
      const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 1.15), glass);
      sideWindow.position.set(x, 3.45, 6.0);
      root.add(sideWindow);
      const mirror = new THREE.Mesh(round(0.12, 0.62, 0.34, 0.05, 2), dark);
      mirror.position.set(x * 1.18, 3.55, 6.15);
      root.add(mirror);
    });
    const visor = new THREE.Mesh(round(2.4, 0.18, 0.55, 0.08, 1), body);
    visor.position.set(0, 4.16, 6.62);
    root.add(visor);
    // grade frontal e faróis
    const grille = new THREE.Mesh(round(2.15, 1.0, 0.12, 0.08, 2), dark);
    grille.position.set(0, 2.05, 6.78);
    root.add(grille);
    for (let i = 0; i < 3; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.1, 0.1), chrome);
      slat.position.set(0, 1.75 + i * 0.3, 6.85);
      root.add(slat);
    }
    const bumper = new THREE.Mesh(round(2.5, 0.55, 0.5, 0.14, 2), body);
    bumper.position.set(0, 1.15, 6.85);
    root.add(bumper);
    [-0.86, 0.86].forEach((x) => {
      const head = new THREE.Mesh(round(0.55, 0.28, 0.12, 0.05, 1), lamp);
      head.position.set(x, 1.55, 6.92);
      root.add(head);
    });
    for (let i = 0; i < 5; i += 1) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.06), lamp);
      marker.position.set(-0.9 + i * 0.45, 4.34, 6.68);
      root.add(marker);
    }
    // tanques e degraus
    [-1.16, 1.16].forEach((x) => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.5, 16), chrome);
      tank.rotation.x = Math.PI / 2;
      tank.position.set(x, 1.1, 3.4);
      root.add(tank);
      const step = new THREE.Mesh(round(0.16, 0.5, 0.7, 0.05, 1), dark);
      step.position.set(x * 1.08, 1.1, 5.2);
      root.add(step);
    });
    // quinta roda
    const fifth = new THREE.Mesh(round(1.6, 0.14, 1.3, 0.05, 1), chrome);
    fifth.position.set(0, 1.25, 2.0);
    root.add(fifth);
    // carreta
    const trailer = new THREE.Mesh(round(2.56, 2.95, 12.4, 0.12, 2), body);
    trailer.position.set(0, 3.05, -4.4);
    root.add(trailer);
    const skirt = new THREE.Mesh(round(2.6, 0.5, 12.4, 0.08, 1), dark);
    skirt.position.set(0, 1.2, -4.4);
    root.add(skirt);
    const stripe = new THREE.Mesh(round(2.6, 0.16, 12.42, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0x63b32e }));
    stripe.position.set(0, 1.52, -4.4);
    root.add(stripe);
    const rear = new THREE.Mesh(round(2.5, 2.7, 0.14, 0.06, 1), dark);
    rear.position.set(0, 3.0, -10.62);
    root.add(rear);
    [-0.8, 0.8].forEach((x) => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.06), rearLamp);
      tail.position.set(x, 1.35, -10.66);
      root.add(tail);
    });
    // rodas
    const tire = new THREE.MeshStandardMaterial({ color: 0x20241f, roughness: 0.9 });
    const rim = new THREE.MeshStandardMaterial({ color: 0xcfd4d6, roughness: 0.3, metalness: 0.8 });
    const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.36, 20);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.38, 16);
    rimGeo.rotateZ(Math.PI / 2);
    [6.3, -1.4, -2.9, -6.6, -8.1].forEach((z) => {
      [-1.14, 1.14].forEach((x) => {
        const wheel = new THREE.Mesh(wheelGeo, tire);
        wheel.position.set(x, 0.52, z);
        wheel.name = "wheel";
        root.add(wheel);
        const hub = new THREE.Mesh(rimGeo, rim);
        hub.position.set(x, 0.52, z);
        root.add(hub);
      });
    });
    root.traverse((child) => {
      child.castShadow = false;
    });
    return root;
  }

  function queueGlb(request: GlbRequest) {
    if (glbSources[request.key]) applyGlb(request, glbSources[request.key]);
    else glbRequests.push(request);
  }
  function applyGlb(request: GlbRequest, source: THREE.Object3D) {
    source.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(source);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z);
    const scale = request.length / Math.max(0.001, longest);
    request.parts?.forEach((part) => {
      part.visible = false;
    });
    const wrapper = new THREE.Group();
    wrapper.rotation.y = request.rotY;
    const clone = source.clone(true);
    clone.scale.setScalar(scale);
    clone.position.set(
      -(box.min.x + size.x / 2) * scale,
      -box.min.y * scale,
      -(box.min.z + size.z / 2) * scale,
    );
    clone.traverse((child) => {
      if (child.name.toLowerCase().includes("wheel")) {
        child.scale.multiplyScalar(0.62);
      }
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      const tint = (material: THREE.Material) => {
        const std = material.clone() as THREE.MeshStandardMaterial;
        if (std.color) {
          const lum = 0.2126 * std.color.r + 0.7152 * std.color.g + 0.0722 * std.color.b;
          if (request.color !== undefined && lum > 0.32) {
            std.color.lerp(new THREE.Color(request.color), 0.72);
          } else {
            std.color.lerp(new THREE.Color(0xf6f8f2), 0.2);
          }
          if (std.metalness !== undefined) std.metalness = Math.min(std.metalness, 0.4);
          std.needsUpdate = true;
        }
        return std;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material);
    });
    wrapper.add(clone);
    if (request.label) {
      const plateCanvas = document.createElement("canvas");
      plateCanvas.width = 1024;
      plateCanvas.height = 256;
      const plateCtx = plateCanvas.getContext("2d")!;
      plateCtx.fillStyle = "#f7f9f3";
      plateCtx.fillRect(0, 0, 1024, 256);
      plateCtx.fillStyle = "#63b32e";
      plateCtx.fillRect(0, 0, 1024, 16);
      plateCtx.fillRect(0, 240, 1024, 16);
      plateCtx.fillStyle = "#1d2a20";
      plateCtx.font = "700 96px Sora, Inter, sans-serif";
      plateCtx.textBaseline = "middle";
      plateCtx.fillText("get", 150, 104);
      plateCtx.fillStyle = "#63b32e";
      plateCtx.fillText("TMS", 356, 104);
      plateCtx.fillStyle = "#6b7a6d";
      plateCtx.font = "600 40px Inter, sans-serif";
      plateCtx.fillText(request.label, 150, 186);
      plateCtx.fillStyle = "#1d2a20";
      plateCtx.font = "700 34px Inter, sans-serif";
      plateCtx.textAlign = "right";
      plateCtx.fillText("PLATAFORMA TMS", 960, 186);
      plateCtx.textAlign = "left";
      const plateTex = track(new THREE.CanvasTexture(plateCanvas));
      plateTex.colorSpace = THREE.SRGBColorSpace;
      const plateMat = new THREE.MeshBasicMaterial({ map: plateTex, transparent: true });
      [-1, 1].forEach((side) => {
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.85), plateMat);
        plate.position.set(side * 1.32, 2.5, -4.2);
        plate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        wrapper.add(plate);
      });
    }
    request.holder.add(wrapper);
  }

  const truckRequest = { key: "cab-over", holder: truck, parts: [...truck.children], length: 17.0, rotY: 0 };
  proceduralBodies.push({ group: truck, parts: truckRequest.parts });
  queueGlb(truckRequest);

  glbSources["cab-over"] = makeCabOverSource();
  for (let i = glbRequests.length - 1; i >= 0; i -= 1) {
    if (glbRequests[i].key === "cab-over") {
      applyGlb(glbRequests[i], glbSources["cab-over"]);
      glbRequests.splice(i, 1);
    }
  }
  ["semi-truck", "delivery-truck", "delivery-van", "tanker-truck", "1990s-sedan", "1990s-hatchback", "1990s-suv", "1990s-delivery-van", "forklift"].forEach((key) => {
    new GLTFLoader().load(`/models/${key}.glb`, (gltf) => {
      if (disposed) return;
      glbSources[key] = gltf.scene;
      for (let i = glbRequests.length - 1; i >= 0; i -= 1) {
        if (glbRequests[i].key === key) {
          applyGlb(glbRequests[i], gltf.scene);
          glbRequests.splice(i, 1);
        }
      }
    });
  });

  return {
    setProgress(p: number) {
      target = clamp01(p);
    },
    setOrbit(active: boolean) {
      orbitActive = active;
    },
    orbitBy(delta: number) {
      orbitDrag += delta;
    },
    orbitZoom(delta: number) {
      orbitRadius = Math.min(140, Math.max(26, orbitRadius + delta));
    },
    setSegmentZoom(z: number) {
      segmentZoom = Math.min(1.4, Math.max(0.55, z));
    },
    setFeatureScreen(index: number) {
      heroMat.map = heroTextures[Math.max(0, Math.min(3, index))];
      heroMat.needsUpdate = true;
    },
    setSegmentView(kind: string | null) {
      if (!kind) {
        segmentView = null;
        return;
      }
      const view = SEGMENT_VIEWS[kind];
      if (!view) return;
      if (!segmentView) overrideLook.copy(lookTarget);
      segmentView = view;
    },
    setPointer(x: number, y: number) {
      pointerX = x;
      pointerY = y;
    },
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else if (material) material.dispose();
      });
      disposables.forEach((item) => item.dispose());
      shadowTexture.dispose();
      renderer.dispose();
    },
  };
}

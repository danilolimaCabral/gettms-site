import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Diorama logístico em WebGL montado pela rolagem.
 * Progresso 0 → 1 = linha do tempo: estrada, caminhão, armazém, pátio,
 * cidade, viaduto, rota e entrega final entram em cena em sequência.
 */

export type LogisticsSceneHandle = {
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
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
  { t: 0.8, pos: [6, 20, 0], look: [30, 6, -50] },
  { t: 0.9, pos: [0, 22, -6], look: [34, 6, -50] },
  { t: 1.0, pos: [-8, 30, 2], look: [32, 4, -50] },
];

const ROUTE_POINTS: [number, number, number][] = [
  [0, 0.32, 12],
  [-1.2, 0.32, -2],
  [1.2, 0.32, -20],
  [-1.2, 0.32, -40],
  [1.6, 0.32, -52],
  [7, 0.32, -60],
  [12, 0.32, -64],
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.2 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xedf1e8);
  scene.fog = new THREE.FogExp2(0xedf1e8, 0.0042);

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
        uTop: { value: new THREE.Color(0xdfe8d6) },
        uBottom: { value: new THREE.Color(0xf4f7ef) },
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
    uBase: { value: new THREE.Color(0xdde4d6) },
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

  // ---------------------------------------------------------------- luzes
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d3c2, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));

  const key = new THREE.DirectionalLight(0xfff8ec, 2.35);
  key.position.set(30, 50, 30);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xb8e88f, 0.7);
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
    const z = 44 - i * 4.6 - Math.random() * 3;
    const x = side * (12 + Math.random() * 16);
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
    color: 0x1d251f,
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

  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7fff0, transparent: true, opacity: 0 });
  const dashCount = 44;
  const dashes = new THREE.InstancedMesh(round(0.2, 0.05, 3, 0.06, 1), dashMat, dashCount);
  const dashDummy = new THREE.Object3D();
  for (let i = 0; i < dashCount; i += 1) {
    dashDummy.position.set(0, 0.27, 88 - i * 5.8);
    dashDummy.updateMatrix();
    dashes.setMatrixAt(i, dashDummy.matrix);
  }
  road.add(dashes);

  // postes com braço curvo
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7c877c, roughness: 0.7, metalness: 0.3 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-7.9, 7.9].forEach((x) => {
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
  const overpass = new THREE.Group();
  overpass.position.set(0, 0, -74);
  scene.add(overpass);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xdfe5d9, roughness: 0.85, metalness: 0.05 });
  const deck = new THREE.Mesh(round(56, 0.95, 7.5, 0.3, 3), concreteMat);
  deck.position.set(0, 11.4, 0);
  overpass.add(deck);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(64, 0.85, 0.22), new THREE.MeshStandardMaterial({ color: 0xb9c4b2, roughness: 0.6, metalness: 0.3 }));
  rail.position.set(0, 12.3, 3.6);
  overpass.add(rail);

  const railBack = rail.clone();
  railBack.position.z = -3.6;
  overpass.add(railBack);

  const overpassAccent = new THREE.Mesh(new THREE.BoxGeometry(64, 0.16, 0.28), new THREE.MeshBasicMaterial({ color: BRAND }));
  overpassAccent.position.set(0, 10.85, 3.8);
  overpass.add(overpassAccent);

  [-24, 0, 24].forEach((x) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.05, 11.4, 16), concreteMat);
    pillar.position.set(x, 5.7, 0);
    overpass.add(pillar);
    const cap = new THREE.Mesh(round(4.2, 0.7, 3.2, 0.3, 2), concreteMat);
    cap.position.set(x, 10.9, 0);
    overpass.add(cap);
  });

  overpass.scale.y = 0.001;
  overpass.visible = false;

  // ---------------------------------------------------------------- armazém
  const warehouse = new THREE.Group();
  warehouse.position.set(-24, 0, -18);
  scene.add(warehouse);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf7f9f2, roughness: 0.72, metalness: 0.12 });
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
  const truck = new THREE.Group();
  truck.scale.setScalar(0.9);
  scene.add(truck);

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f6ef, roughness: 0.32, metalness: 0.42 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xe3e9dc, roughness: 0.4, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a221c, roughness: 0.4, metalness: 0.7 });
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

  addPerson(12.6, -2, -Math.PI / 2, 0xf0b13a, "z", 5, 0.2);
  addPerson(13.4, 5.6, -Math.PI / 2, 0x8fe04a, "z", 4, 0.22);
  addPerson(7.6, -3.4, 0.4, 0x8fe04a, null, 0, 0.24);
  addPerson(-2, 6, 2.2, 0xf0b13a, null, 0, 0.26);
  addPerson(20.5, 6.5, -1.2, 0x8fe04a, "x", 3, 0.28);
  addPerson(-14, -102, 0.6, 0xf0b13a, null, 0, 0.86);
  addPerson(-6, -99, -0.4, 0x8fe04a, "x", 4, 0.88);
  addPerson(24, -100, 1.8, 0xffffff, null, 0, 0.9);

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

  // ---------------------------------------------------------------- CD do cliente
  const clientDc = new THREE.Group();
  clientDc.position.set(38, 0, -62);
  scene.add(clientDc);

  const dcBody = new THREE.Mesh(round(34, 11, 20, 0.6, 3), wallMat);
  dcBody.position.y = 5.5;
  clientDc.add(dcBody);

  const dcRoof = new THREE.Mesh(round(35.6, 0.6, 21.6, 0.3, 2), roofMat);
  dcRoof.position.y = 11.2;
  clientDc.add(dcRoof);

  const dcPlinth = new THREE.Mesh(round(34.6, 0.7, 20.6, 0.2, 2), trimMat);
  dcPlinth.position.y = 0.35;
  clientDc.add(dcPlinth);

  const dcAccent = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 20.2), stripMat);
  dcAccent.position.set(-17.05, 10.1, 0);
  clientDc.add(dcAccent);

  // nome da empresa cliente na fachada
  const dcSignCanvas = document.createElement("canvas");
  dcSignCanvas.width = 1024;
  dcSignCanvas.height = 256;
  const dcSignCtx = dcSignCanvas.getContext("2d")!;
  dcSignCtx.clearRect(0, 0, 1024, 256);
  dcSignCtx.fillStyle = "#0d150f";
  dcSignCtx.font = "700 120px Sora, Inter, sans-serif";
  dcSignCtx.textBaseline = "middle";
  dcSignCtx.textAlign = "center";
  dcSignCtx.fillText("MATSUYAMA", 512, 120);
  dcSignCtx.fillStyle = "#63b32e";
  dcSignCtx.font = "600 44px Inter, sans-serif";
  dcSignCtx.fillText("CENTRO DE DISTRIBUIÇÃO · getTMS", 512, 206);
  const dcSignTexture = track(new THREE.CanvasTexture(dcSignCanvas));
  dcSignTexture.colorSpace = THREE.SRGBColorSpace;
  const dcSign = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 5),
    new THREE.MeshBasicMaterial({ map: dcSignTexture, transparent: true }),
  );
  dcSign.position.set(0, 9.1, 10.12);
  dcSign.scale.set(1, 0.72, 1);
  clientDc.add(dcSign);

  // docas voltadas para a estrada (-x)
  const dcDoorMaterials: THREE.MeshBasicMaterial[] = [];
  const dcDoorX = [-14, 0, 14];
  for (let i = 0; i < 3; i += 1) {
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0 });
    dcDoorMaterials.push(doorMat);
    const door = new THREE.Mesh(round(4.4, 5, 0.2, 0.08, 2), doorMat);
    door.position.set(dcDoorX[i], 2.7, 10.06);
    clientDc.add(door);
    const lintel = new THREE.Mesh(round(4.8, 0.45, 0.9, 0.12, 2), trimMat);
    lintel.position.set(dcDoorX[i], 5.5, 10.15);
    clientDc.add(lintel);
    const canopy = new THREE.Mesh(round(5.2, 0.28, 3.6, 0.1, 2), trimMat);
    canopy.position.set(dcDoorX[i], 6.2, 11.4);
    clientDc.add(canopy);
  }

  const dcLight = new THREE.PointLight(0xffd9a0, 35, 40, 2);
  dcLight.position.set(0, 5, 14);
  clientDc.add(dcLight);

  // escritório de análise, anexo à frente do CD
  const office = new THREE.Group();
  office.position.set(6, 11.4, 0);
  clientDc.add(office);

  const officeShell = new THREE.Mesh(round(18, 9, 10, 0.4, 3), wallMat);
  officeShell.position.y = 4.5;
  office.add(officeShell);

  const officeRoof = new THREE.Mesh(round(19, 0.5, 11, 0.25, 2), roofMat);
  officeRoof.position.y = 9.2;
  office.add(officeRoof);

  const officeGlassMat = new THREE.MeshStandardMaterial({
    color: 0xd2e9ef,
    roughness: 0.08,
    metalness: 0.9,
    transparent: true,
    opacity: 0.16,
  });
  const officeGlass = new THREE.Mesh(round(17.2, 7.6, 0.2, 0.1, 2), officeGlassMat);
  officeGlass.position.set(0, 4.4, 5.75);
  office.add(officeGlass);

  const officeInterior = new THREE.Mesh(round(17, 7.4, 0.12, 0.05, 1), new THREE.MeshStandardMaterial({ color: 0x2a3830, roughness: 0.85 }));
  officeInterior.position.set(0, 4.2, 4.95);
  office.add(officeInterior);

  const monitorMats: THREE.MeshBasicMaterial[] = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const monitorMat = new THREE.MeshBasicMaterial({ color: 0x9ff0c0, transparent: true, opacity: 0 });
      monitorMats.push(monitorMat);
      const monitor = new THREE.Mesh(round(1.8, 1.1, 0.12, 0.06, 2), monitorMat);
      monitor.position.set(-6.4 + col * 3.2, 3.15 + row * 3.4, 5.15);
      office.add(monitor);

      const desk = new THREE.Mesh(round(2.4, 0.14, 1.2, 0.06, 2), unitMat);
      desk.position.set(-6.4 + col * 3.2, 2.4 + row * 3.4, 5.35);
      office.add(desk);

      const analyst = new THREE.Mesh(round(0.62, 0.9, 0.5, 0.24, 2), new THREE.MeshStandardMaterial({ color: 0x3b4a3f, roughness: 0.8 }));
      analyst.position.set(-6.4 + col * 3.2, 2.95 + row * 3.4, 5.6);
      office.add(analyst);

      const analystHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skinMats[(row * 5 + col) % skinMats.length]);
      analystHead.position.set(-6.4 + col * 3.2, 3.5 + row * 3.4, 5.6);
      office.add(analystHead);
    }
  }

  // fluxo de dados das docas para o escritório
  const dataFlows: { curve: THREE.CatmullRomCurve3; tube: THREE.Mesh; speed: number }[] = [];
  [-6, 0, 6].forEach((z, index) => {
    const flowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-19, 6.4, z),
      new THREE.Vector3(-16, 10.5, z),
      new THREE.Vector3(-10, 14, 2),
      new THREE.Vector3(-2, 15.6, 3.5),
      new THREE.Vector3(4, 14.6, 4),
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(flowCurve, 90, 0.07, 6, false),
      new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0 }),
    );
    clientDc.add(tube);
    dataFlows.push({ curve: flowCurve, tube, speed: 0.35 + index * 0.08 });
  });

  const flowDots = [0, 1, 2].map(() => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xeaffd2, transparent: true, opacity: 0 }),
    );
    clientDc.add(dot);
    return dot;
  });

  clientDc.scale.y = 0.001;

  // caminhões parados nas docas do CD, com nome no baú
  const dcTrucks: THREE.Group[] = [];
  dcDoorX.forEach((doorX, index) => {
    const clone = truck.clone(true);
    clone.traverse((child) => {
      const light = child as THREE.PointLight;
      if (light.isPointLight) light.intensity = 0;
    });
    const sideTexture = track(makeTruckSideTexture(truckNames[index]));
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (material.map && material.map.image && (material.map.image as HTMLCanvasElement).height === 384) {
          mesh.material = new THREE.MeshBasicMaterial({ map: sideTexture, transparent: true });
        }
      }
    });
    clone.position.set(doorX, 0, 16);
    clone.rotation.y = Math.PI / 2;
    clone.scale.setScalar(0.001);
    clientDc.add(clone);
    dcTrucks.push(clone);
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
    groundUniforms.uProgress.value = easeOut(range(p, 0.0, 0.22));

    const roadReveal = easeOut(range(p, 0.0, 0.1));
    asphaltMat.opacity = roadReveal;
    curbMat.opacity = roadReveal;
    edgeMat.opacity = roadReveal * 0.5;
    dashMat.opacity = roadReveal * 0.85;

    const treesIn = easeOut(range(p, 0.06, 0.22));
    treeGroup.scale.y = Math.max(0.001, treesIn);

    nodes.forEach((node) => {
      const t = easeOut(range(p, 0.48 + node.delay, 0.6 + node.delay));
      node.group.scale.setScalar(Math.max(0.001, t));
      const breathe = 0.55 + Math.sin(time * 2 + node.delay * 14) * 0.25;
      (node.ring.material as THREE.MeshBasicMaterial).opacity = t * breathe;
      (node.beam.material as THREE.MeshBasicMaterial).opacity = t * 0.14;
    });

    // caminhão: aproxima, estaciona na doca e depois parte
    const enter = easeInOut(range(p, 0.05, 0.24));
    const depart = easeInOut(range(p, 0.6, 0.94));
    truck.position.z = lerp(46, -6, enter) - depart * 56;
    truck.position.x = Math.sin(time * 0.9) * 0.05;
    truck.visible = p > 0.03;
    const wheelSpin = time * (2.4 + enter * 6 + depart * 8);
    wheels.forEach((wheel) => {
      wheel.rotation.x = wheelSpin;
    });

    // furgão no sentido oposto, em loop
    const vanTravel = (time * 0.06 + p * 0.4) % 1;
    van.position.z = lerp(-118, 46, vanTravel);
    van.visible = p > 0.08;

    // armazém
    const rise = easeOut(range(p, 0.12, 0.28));
    warehouse.scale.y = Math.max(0.001, rise);
    doorMaterials.forEach((material) => {
      material.opacity = Math.min(1, rise * 1.1);
    });
    dockLight.intensity = 40 * rise;

    const forkliftIn = easeOut(range(p, 0.2, 0.3));
    forklift.scale.setScalar(Math.max(0.001, forkliftIn));
    forklift.position.z = 4 + Math.sin(time * 0.8) * 0.6;

    palletGroup.children.forEach((pallet, index) => {
      const t = easeOut(range(p, 0.22 + index * 0.03, 0.3 + index * 0.03));
      pallet.scale.setScalar(Math.max(0.001, t));
    });

    // contêineres
    crates.forEach((crate) => {
      const t = easeOut(range(p, 0.2 + crate.delay, 0.3 + crate.delay));
      crate.mesh.scale.setScalar(Math.max(0.001, t));
      crate.mesh.position.y = lerp(crate.baseY + 10, crate.baseY, t);
      crate.mesh.rotation.y = crate.spin * (1 - t);
    });

    // viaduto
    const bridgeIn = easeOut(range(p, 0.4, 0.52));
    overpass.visible = bridgeIn > 0.001;
    overpass.scale.y = Math.max(0.001, bridgeIn);

    // cidade
    towers.forEach((tower) => {
      const t = easeOut(range(p, 0.4 + tower.delay, 0.54 + tower.delay));
      tower.mesh.scale.y = Math.max(0.001, t);
      tower.mesh.position.y = (tower.height / 2) * t;
      const cap = tower.mesh.userData.cap as THREE.Mesh | undefined;
      if (cap) {
        cap.scale.y = Math.max(0.001, t);
        cap.position.y = tower.height * t + 0.3;
      }
    });

    // hub de entrega
    const hubIn = easeOut(range(p, 0.74, 0.86));
    hub.scale.y = Math.max(0.001, hubIn) * 1.15;
    parcels.children.forEach((parcel, index) => {
      const t = easeOut(range(p, 0.84 + index * 0.03, 0.92 + index * 0.03));
      parcel.scale.setScalar(Math.max(0.001, t));
    });

    // pessoas
    people.forEach((person, index) => {
      const t = easeOut(range(p, 0.1 + person.delay, 0.2 + person.delay));
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
      const t = easeOut(range(p, 0.08 + car.delay, 0.16 + car.delay));
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
    const droneIn = easeOut(range(p, 0.18, 0.28));
    drone.scale.setScalar(Math.max(0.001, droneIn));
    const orbit = time * 0.35;
    drone.position.set(10 + Math.cos(orbit) * 9, 13 + Math.sin(time * 1.4) * 0.6, -4 + Math.sin(orbit) * 9);
    drone.rotation.y = -orbit;
    rotors.forEach((rotor, index) => {
      rotor.rotation.y = time * (20 + index * 3);
    });
    (droneLed.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(time * 6) > 0 ? 0xff6b5a : 0x5a2a24);

    // antena e anéis de dados
    const antennaIn = easeOut(range(p, 0.46, 0.58));
    antenna.scale.y = Math.max(0.001, antennaIn);
    (antennaLed.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(time * 3) > 0.2 ? 0xff6b5a : 0x4a2420);
    dataRings.forEach((ring, index) => {
      const t = easeOut(range(p, 0.5 + index * 0.04, 0.6 + index * 0.04));
      ring.scale.setScalar(Math.max(0.001, t));
      ring.rotation.z = time * (0.12 + index * 0.05);
      (ring.material as THREE.MeshBasicMaterial).opacity = t * (0.2 - index * 0.04) * (0.7 + Math.sin(time * 2 + index) * 0.3);
    });

    // CD do cliente, caminhões na doca e escritório
    const dcIn = easeOut(range(p, 0.68, 0.8));
    clientDc.scale.y = Math.max(0.001, dcIn);
    dcDoorMaterials.forEach((material) => {
      material.opacity = Math.min(1, dcIn * 1.2) * (0.75 + Math.sin(time * 1.6) * 0.15);
    });
    dcLight.intensity = 35 * dcIn;
    dcTrucks.forEach((clone, index) => {
      const t = easeOut(range(p, 0.74 + index * 0.04, 0.84 + index * 0.04));
      clone.scale.setScalar(Math.max(0.001, t * 0.92));
      clone.position.z = lerp(26, 16, t);
    });
    monitorMats.forEach((material, index) => {
      const t = easeOut(range(p, 0.88 + (index % 5) * 0.012, 0.95 + (index % 5) * 0.012));
      material.opacity = t * (0.6 + Math.sin(time * 3 + index) * 0.25);
      material.color.setHex(index % 3 === 0 ? 0xbfffd6 : index % 3 === 1 ? 0x9fe0ff : 0xdfffc0);
    });
    dataFlows.forEach((flow, index) => {
      const t = easeOut(range(p, 0.86 + index * 0.02, 0.94 + index * 0.02));
      (flow.tube.material as THREE.MeshBasicMaterial).opacity = t * 0.55;
      const dot = flowDots[index];
      (dot.material as THREE.MeshBasicMaterial).opacity = t;
      dot.visible = t > 0.01;
      const travel = (time * flow.speed * 0.35 + index * 0.25) % 1;
      flow.curve.getPointAt(travel, dot.position);
    });

    // rota
    const routeT = easeInOut(range(p, 0.48, 0.82));
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

    const arrival = easeOut(range(p, 0.88, 1));
    (arrivalRing.material as THREE.MeshBasicMaterial).opacity = arrival * (0.35 + Math.sin(time * 3) * 0.2);
    arrivalRing.scale.setScalar(0.8 + arrival * 0.7 + Math.sin(time * 3) * 0.06);

    const array = particleGeo.getAttribute("position") as THREE.BufferAttribute;
    const data = array.array as Float32Array;
    for (let i = 0; i < particleCount; i += 1) {
      data[i * 3 + 1] += speeds[i] * 0.012;
      if (data[i * 3 + 1] > 28) data[i * 3 + 1] = 0;
    }
    array.needsUpdate = true;
    (particles.material as THREE.PointsMaterial).opacity = 0.25 + 0.35 * range(p, 0.05, 0.5);
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

    sampleCamera(current, camPos, lookTarget);

    const aspect = width / height;
    if (aspect < 1.3) {
      const pull = Math.min(2.05, 1.32 / aspect);
      camPos.sub(lookTarget).multiplyScalar(pull).add(lookTarget);
    }

    camPos.x += smoothX * 2.6;
    camPos.y += smoothY * 1.8;

    camera.position.copy(camPos);
    camera.lookAt(lookTarget);

    applyProgress(current, elapsed);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }

  resize();
  frame = requestAnimationFrame(render);

  return {
    setProgress(p: number) {
      target = clamp01(p);
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

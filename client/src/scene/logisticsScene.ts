import * as THREE from "three";

/**
 * Diorama logístico em WebGL montado pela rolagem.
 * Progresso 0 → 1 = linha do tempo: terreno, estrada, caminhão, armazém,
 * contêineres, rota e chegada entram em cena em sequência.
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

type CamKey = { t: number; pos: [number, number, number]; look: [number, number, number] };

const CAMERA_KEYS: CamKey[] = [
  { t: 0.0, pos: [36, 16, 40], look: [-24, 3, 6] },
  { t: 0.2, pos: [26, 14, 34], look: [-17, 3, -3] },
  { t: 0.38, pos: [8, 15, 30], look: [-10, 4, -14] },
  { t: 0.56, pos: [-2, 17, 24], look: [-14, 4, -16] },
  { t: 0.72, pos: [2, 20, 34], look: [-4, 3, -22] },
  { t: 0.88, pos: [10, 32, 44], look: [0, 0.5, -26] },
  { t: 1.0, pos: [8, 42, 36], look: [0, 0, -30] },
];

const ROUTE_POINTS: [number, number, number][] = [
  [0, 0.32, 12],
  [-2.6, 0.32, -2],
  [2.6, 0.32, -18],
  [-2.2, 0.32, -36],
  [0, 0.32, -56],
];

function makeShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.9)");
  gradient.addColorStop(0.5, "rgba(0,0,0,0.4)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.4 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xedf1e8);
  scene.fog = new THREE.FogExp2(0xedf1e8, 0.0046);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
  camera.position.set(19, 8.5, 36);

  const shadowTexture = makeShadowTexture();

  // ---------------------------------------------------------------- ground
  const groundUniforms = {
    uProgress: { value: 0 },
    uLine: { value: new THREE.Color(0x93a98a) },
    uBase: { value: new THREE.Color(0xe2e8db) },
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700, 1, 1),
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
          float fade = 1.0 - smoothstep(50.0, 240.0, dist);
          float reveal = smoothstep(0.0, 1.0, 0.3 + uProgress * 1.4 - dist / 210.0);
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

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d3c2, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const key = new THREE.DirectionalLight(0xfff8ec, 2.3);
  key.position.set(28, 46, 26);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xb8e88f, 0.7);
  rim.position.set(-38, 16, -30);
  scene.add(rim);

  const cool = new THREE.DirectionalLight(0xc3d2f2, 0.35);
  cool.position.set(6, 10, -46);
  scene.add(cool);

  // ---------------------------------------------------------------- yard pad
  const padMat = new THREE.MeshStandardMaterial({
    color: 0xe3e9dd,
    roughness: 0.95,
    metalness: 0.05,
    transparent: true,
    opacity: 0,
  });
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(70, 62), padMat);
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(-14, 0.02, -14);
  scene.add(yard);

  // ---------------------------------------------------------------- road
  const road = new THREE.Group();
  scene.add(road);

  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x232b23,
    roughness: 0.9,
    metalness: 0.12,
    transparent: true,
    opacity: 0,
  });
  const asphalt = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.26, 240), asphaltMat);
  asphalt.position.set(0, 0.1, -20);
  road.add(asphalt);

  const edgeMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0 });
  [-5.55, 5.55].forEach((x) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 240), edgeMat);
    edge.position.set(x, 0.25, -20);
    road.add(edge);
  });

  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7fff0, transparent: true, opacity: 0 });
  const dashCount = 40;
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.04, 3), dashMat, dashCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < dashCount; i += 1) {
    dummy.position.set(0, 0.25, 78 - i * 5.8);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  }
  road.add(dashes);

  // ---------------------------------------------------------------- light poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7c877c, roughness: 0.7, metalness: 0.3 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-7.6, 7.6].forEach((x) => {
    for (let i = 0; i < 5; i += 1) {
      const z = 30 - i * 22;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 8, 8), poleMat);
      pole.position.set(x, 4, z);
      road.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), lampMat);
      lamp.position.set(x - Math.sign(x) * 0.5, 8, z);
      road.add(lamp);
    }
  });

  // ---------------------------------------------------------------- skyline
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0xc6d0bb, roughness: 0.9, metalness: 0.1 });
  const skyline = new THREE.Group();
  for (let i = 0; i < 26; i += 1) {
    const w = 6 + Math.random() * 10;
    const h = 6 + Math.random() * 26;
    const d = 6 + Math.random() * 10;
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    block.position.set(-160 + i * 13 + Math.random() * 6, h / 2, -150 - Math.random() * 40);
    skyline.add(block);
  }
  scene.add(skyline);

  // ---------------------------------------------------------------- nodes
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
      new THREE.MeshBasicMaterial({
        color: BRAND,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.y = 8;
    group.add(beam);

    group.scale.setScalar(0.001);
    scene.add(group);
    nodes.push({ group, ring, beam, delay: index * 0.04 });
  });

  // ---------------------------------------------------------------- warehouse
  const warehouse = new THREE.Group();
  warehouse.position.set(-21, 0, -16);
  scene.add(warehouse);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf6f8f1, roughness: 0.7, metalness: 0.15 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xdfe6d8, roughness: 0.8, metalness: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x222a22, roughness: 0.55, metalness: 0.5 });
  const stripMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.9 });

  const warehouseParts: THREE.Object3D[] = [];
  const fadeMaterials: (THREE.Material & { opacity: number })[] = [];

  const bodyGeo = new THREE.BoxGeometry(24, 9.5, 18);
  bodyGeo.translate(0, 4.75, 0);
  warehouse.add(new THREE.Mesh(bodyGeo, wallMat));
  warehouseParts.push(warehouse.children[warehouse.children.length - 1]);

  const roofGeo = new THREE.BoxGeometry(25.6, 0.6, 19.6);
  roofGeo.translate(0, 9.8, 0);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  warehouse.add(roof);
  warehouseParts.push(roof);

  // faixa luminosa no topo da fachada voltada para a estrada
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 18.2), stripMat);
  strip.position.set(12.05, 8.9, 0);
  warehouse.add(strip);
  warehouseParts.push(strip);

  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x333d34, roughness: 0.6, metalness: 0.3 });
  [
    [-12, 0, -9],
    [-12, 0, 9],
    [12, 0, -9],
    [12, 0, 9],
  ].forEach(([x, , z]) => {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.7, 10, 0.7), cornerMat);
    column.position.set(x, 5, z);
    warehouse.add(column);
    warehouseParts.push(column);
  });

  // docas voltadas para a estrada (+x)
  for (let i = 0; i < 4; i += 1) {
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0xffc46b,
      transparent: true,
      opacity: 0,
    });
    fadeMaterials.push(doorMat as THREE.Material & { opacity: number });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.6), doorMat);
    door.position.set(12.06, 2.4, -6.3 + i * 4.2);
    door.rotation.y = Math.PI / 2;
    warehouse.add(door);
    warehouseParts.push(door);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 3.8), trimMat);
    lintel.position.set(12.15, 5.05, -6.3 + i * 4.2);
    warehouse.add(lintel);
    warehouseParts.push(lintel);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 4.2), trimMat);
    canopy.position.set(13.3, 5.5, -6.3 + i * 4.2);
    warehouse.add(canopy);
    warehouseParts.push(canopy);
  }

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(24.6, 0.7, 18.6), trimMat);
  plinth.position.set(0, 0.35, 0);
  warehouse.add(plinth);
  warehouseParts.push(plinth);

  const frontStrip = new THREE.Mesh(new THREE.BoxGeometry(24.2, 0.22, 0.14), stripMat);
  frontStrip.position.set(0, 8.9, 9.06);
  warehouse.add(frontStrip);
  warehouseParts.push(frontStrip);

  const unitMat = new THREE.MeshStandardMaterial({ color: 0xb9c3b2, roughness: 0.7, metalness: 0.35 });
  [
    [-7, -4],
    [-1, 3],
    [6, -2],
  ].forEach(([x, z]) => {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 2.2), unitMat);
    unit.position.set(x, 10.4, z);
    warehouse.add(unit);
    warehouseParts.push(unit);
  });

  const skylightMat = new THREE.MeshBasicMaterial({ color: 0xf4ffe4, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 5; i += 1) {
    const sky = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.2), skylightMat);
    sky.position.set(-8 + i * 4, 10.14, 6);
    warehouse.add(sky);
    warehouseParts.push(sky);
  }

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
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.25),
    new THREE.MeshBasicMaterial({ map: signTexture, transparent: true }),
  );
  sign.position.set(0, 7.4, 9.12);
  warehouse.add(sign);
  warehouseParts.push(sign);

  const dockLight = new THREE.PointLight(0xffdba0, 40, 34, 2);
  dockLight.position.set(14, 4, -1);
  warehouse.add(dockLight);

  const dockShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 22),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  dockShadow.rotation.x = -Math.PI / 2;
  dockShadow.position.set(4, 0.06, 0);
  warehouse.add(dockShadow);
  warehouseParts.push(dockShadow);

  warehouse.scale.y = 0.001;

  // ---------------------------------------------------------------- containers
  type Crate = { mesh: THREE.Mesh; baseY: number; delay: number; spin: number };
  const crates: Crate[] = [];
  const crateColors = [BRAND_DEEP, 0xffffff, 0x24302a, 0x9bd65a, 0x4a5c50];

  const crateLayout: { x: number; y: number; z: number; ry: number; color: number }[] = [
    { x: 16, y: 1.35, z: -2, ry: 0, color: 0 },
    { x: 16, y: 4.05, z: -2, ry: 0, color: 1 },
    { x: 22.6, y: 1.35, z: -2, ry: 0, color: 2 },
    { x: 22.6, y: 4.05, z: -2, ry: 0, color: 3 },
    { x: 16, y: 6.75, z: -2, ry: 0, color: 4 },
    { x: 19.3, y: 1.35, z: -9.4, ry: 0, color: 1 },
    { x: 19.3, y: 4.05, z: -9.4, ry: 0, color: 0 },
  ];

  crateLayout.forEach((layout, index) => {
    const mat = new THREE.MeshStandardMaterial({
      color: crateColors[layout.color % crateColors.length],
      roughness: 0.55,
      metalness: 0.4,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.5), mat);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 2.6, 2.5)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
    );
    mesh.add(edges);
    mesh.position.set(layout.x, layout.y + 8, layout.z);
    mesh.rotation.y = layout.ry;
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
    crates.push({ mesh, baseY: layout.y, delay: index * 0.05, spin: (index % 2 === 0 ? 1 : -1) * 0.5 });
  });

  // ---------------------------------------------------------------- truck
  const truck = new THREE.Group();
  truck.scale.setScalar(0.9);
  scene.add(truck);

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeef2e9, roughness: 0.4, metalness: 0.32 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x161d18, roughness: 0.45, metalness: 0.6 });
  const greenMat = new THREE.MeshBasicMaterial({ color: BRAND });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1216,
    roughness: 0.12,
    metalness: 0.9,
    emissive: 0x21414f,
    emissiveIntensity: 0.6,
  });

  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.85, 3.2, 11.6), whiteMat);
  trailer.position.set(0, 2.85, -3.4);
  truck.add(trailer);

  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.5, 11.6), darkMat);
  skirt.position.set(0, 1.15, -3.4);
  truck.add(skirt);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 11.62), greenMat);
  stripe.position.set(0, 1.46, -3.4);
  truck.add(stripe);

  [-1.46, 1.46].forEach((x) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 3.4), greenMat);
    panel.position.set(x, 3.1, -3.4);
    truck.add(panel);
  });

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.75, 2.85, 3.3), darkMat);
  cab.position.set(0, 2.4, 4.2);
  truck.add(cab);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.2, 0.06), glassMat);
  windshield.position.set(0, 3, 5.88);
  truck.add(windshield);

  const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 1.6), glassMat);
  sideWindow.position.set(1.39, 3, 4.4);
  truck.add(sideWindow);

  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.14), greenMat);
  lightBar.position.set(0, 3.9, 5.82);
  truck.add(lightBar);

  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xf6ffdf });
  [-0.95, 0.95].forEach((x) => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), headlightMat);
    light.position.set(x, 1.5, 5.92);
    truck.add(light);
  });

  const headlight = new THREE.PointLight(0xdcffb4, 30, 32, 2);
  headlight.position.set(0, 1.7, 7.6);
  truck.add(headlight);

  const wheelGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.5, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0d0b, roughness: 0.95 });
  const wheels: THREE.Mesh[] = [];
  [4.2, 1.1, -4.2, -7.2].forEach((z) => {
    [-1.3, 1.3].forEach((x) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, 0.68, z);
      truck.add(wheel);
      wheels.push(wheel);
    });
  });

  const truckShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 24),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  truckShadow.rotation.x = -Math.PI / 2;
  truckShadow.position.set(0, 0.2, 0);
  truck.add(truckShadow);

  truck.position.set(0, 0, 12);

  // ---------------------------------------------------------------- route line
  const curve = new THREE.CatmullRomCurve3(
    ROUTE_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const tubeGeo = new THREE.TubeGeometry(curve, 260, 0.1, 8, false);
  const routeLine = new THREE.Mesh(
    tubeGeo,
    new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.95 }),
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
    new THREE.MeshBasicMaterial({
      color: BRAND,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  pulse.add(pulseGlow);

  const arrivalRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.7, 64),
    new THREE.MeshBasicMaterial({
      color: BRAND,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  arrivalRing.rotation.x = -Math.PI / 2;
  const lastPoint = ROUTE_POINTS[ROUTE_POINTS.length - 1];
  arrivalRing.position.set(lastPoint[0], 0.34, lastPoint[2]);
  scene.add(arrivalRing);

  // ---------------------------------------------------------------- particles
  const particleCount = low ? 220 : 520;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 110;
    positions[i * 3 + 1] = Math.random() * 24;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 180 - 20;
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

  // ---------------------------------------------------------------- state
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
    groundUniforms.uProgress.value = easeOut(range(p, -0.08, 0.3));

    const roadReveal = easeOut(range(p, -0.1, 0.16));
    asphaltMat.opacity = roadReveal;
    padMat.opacity = roadReveal * 0.9;
    edgeMat.opacity = roadReveal * 0.5;
    dashMat.opacity = roadReveal * 0.85;
    asphalt.scale.z = lerp(0.4, 1, roadReveal);

    nodes.forEach((node) => {
      const t = easeOut(range(p, 0.02 + node.delay, 0.2 + node.delay));
      node.group.scale.setScalar(Math.max(0.001, t));
      const breathe = 0.55 + Math.sin(time * 2 + node.delay * 14) * 0.25;
      (node.ring.material as THREE.MeshBasicMaterial).opacity = t * breathe;
      (node.beam.material as THREE.MeshBasicMaterial).opacity = t * 0.14;
    });

    const enter = easeInOut(range(p, 0.02, 0.36));
    const depart = easeInOut(range(p, 0.66, 0.94));
    truck.position.z = lerp(12, -6, enter) - depart * 50;
    truck.position.x = Math.sin(time * 0.9) * 0.05;
    const wheelSpin = time * (2.4 + enter * 6 + depart * 8);
    wheels.forEach((wheel) => {
      wheel.rotation.x = wheelSpin;
    });
    truck.visible = true;

    const rise = easeOut(range(p, 0.4, 0.64));
    warehouse.scale.y = Math.max(0.001, rise);
    fadeMaterials.forEach((material) => {
      material.opacity = Math.min(1, rise * 1.1);
    });
    dockLight.intensity = 40 * rise;

    crates.forEach((crate) => {
      const t = easeOut(range(p, 0.5 + crate.delay, 0.72 + crate.delay));
      crate.mesh.scale.setScalar(Math.max(0.001, t));
      crate.mesh.position.y = lerp(crate.baseY + 10, crate.baseY, t);
      crate.mesh.rotation.y = crate.spin * (1 - t);
    });

    const routeT = easeInOut(range(p, 0.7, 0.94));
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

    const arrival = easeOut(range(p, 0.9, 1));
    (arrivalRing.material as THREE.MeshBasicMaterial).opacity = arrival * (0.35 + Math.sin(time * 3) * 0.2);
    arrivalRing.scale.setScalar(0.8 + arrival * 0.6 + Math.sin(time * 3) * 0.06);

    const array = particleGeo.getAttribute("position") as THREE.BufferAttribute;
    const data = array.array as Float32Array;
    for (let i = 0; i < particleCount; i += 1) {
      data[i * 3 + 1] += speeds[i] * 0.012;
      if (data[i * 3 + 1] > 26) data[i * 3 + 1] = 0;
    }
    array.needsUpdate = true;
    (particles.material as THREE.PointsMaterial).opacity = 0.25 + 0.35 * range(p, 0.05, 0.5);
  }

  function render() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += dt;

    current += (target - current) * Math.min(1, dt * 4.2);
    smoothX += (pointerX - smoothX) * Math.min(1, dt * 3);
    smoothY += (pointerY - smoothY) * Math.min(1, dt * 3);

    sampleCamera(current, camPos, lookTarget);

    // em telas verticais, afasta a câmera para manter o diorama inteiro no quadro
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
      shadowTexture.dispose();
      renderer.dispose();
    },
  };
}

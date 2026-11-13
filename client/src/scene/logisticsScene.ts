import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Diorama logístico em WebGL montado pela rolagem.
 * Progresso 0 → 1 = linha do tempo: estrada, caminhão, armazém, pátio,
 * cidade, viaduto, rota e entrega final entram em cena em sequência.
 */

export type TruckInfo = {
  plate: string;
  order: string;
  status: string;
  route: string;
  driver: string;
  eta: string;
};
export type LogisticsSceneHandle = {
  scene3d?: THREE.Scene;
  camera3d?: THREE.PerspectiveCamera;
  setProgress: (p: number) => void;
  setWeather: (mode: "auto" | "day" | "night" | "rain") => void;
  setActive: (active: boolean) => void;
  setPointer: (x: number, y: number) => void;
  setOrbit: (active: boolean) => void;
  setSegmentView: (kind: string | null) => void;
  setFeatureScreen: (index: number) => void;
  setSegmentZoom: (z: number) => void;
  setOnTruckClick?: (cb: ((info: TruckInfo) => void) | null) => void;
  debugCam?: () => {
    pos: number[];
    zoom: number;
    view: string;
    truck?: number[];
    phase?: number;
    weather?: string;
    progress?: number;
  };
  snapTruck?: () => void;
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
  { t: 0.0, pos: [56, 30, 58], look: [-16, 4, 0] },
  { t: 0.1, pos: [44, 24, 44], look: [-16, 4, -8] },
  { t: 0.2, pos: [24, 18, 28], look: [-14, 4, -14] },
  { t: 0.3, pos: [42, 20, 24], look: [12, 5, -10] },
  { t: 0.4, pos: [34, 26, -6], look: [0, 2, -120] },
  { t: 0.5, pos: [14, 30, -140], look: [40, 2, -200] },
  { t: 0.6, pos: [90, 38, -160], look: [180, 2, -204] },
  { t: 0.7, pos: [240, 32, -180], look: [300, 2, -260] },
  { t: 0.8, pos: [318, 24, -300], look: [299, 2, -386] },
  { t: 0.86, pos: [344, 16, -404], look: [392, 4, -358] },
  { t: 0.9, pos: [340, 24, -424], look: [394, 5, -356] },
  { t: 0.915, pos: [356, 17, -410], look: [392, 4, -356] },
  { t: 0.95, pos: [412, 7.5, -368], look: [438, 5, -368] },
  { t: 0.975, pos: [352, 13, -384], look: [388, 3.2, -356] },
  { t: 0.99, pos: [300, 190, -320], look: [220, 0, -260] },
  { t: 1.0, pos: [10, 400, 190], look: [-175, 0, 25] },
];

/**
 * Trajeto do caminhão protagonista, em coordenadas de chão (x, z).
 * Avenida inteira (mão sul) -> trevo com semáforo -> via expressa (mão leste) ->
 * saída para a periferia -> rua da periferia -> portaria e pátio do cliente.
 */
const HERO_ROUTE: [number, number][] = [
  [-4.4, 74],
  [-4.4, 34],
  [-4.4, -6],
  [-4.4, -46],
  [-4.4, -88],
  [-4.4, -128],
  [-4.4, -156],
  [-4.4, -176],
  [-5.4, -184],
  [-2.6, -191],
  [5, -199],
  [17, -203.2],
  [52, -203.2],
  [100, -203.2],
  [150, -203.2],
  [200, -203.2],
  [236, -203.2],
  [256, -205],
  [276, -211],
  [291, -221],
  [296.6, -236],
  [296.6, -272],
  [296.6, -308],
  [296.6, -342],
  [299, -362],
  [307, -374],
  [318, -379.5],
  [334, -380.5],
  [350, -378],
  [366, -374],
  [380, -371],
  [388, -372],
  [388, -376],
];

/** Marcos do trajeto: [progresso da página, índice do ponto]. */
const HERO_ROUTE_KEYS: [number, number][] = [
  [0.05, 0],
  [0.16, 2],
  [0.26, 4],
  [0.34, 6],
  [0.42, 9],
  [0.5, 11],
  [0.6, 14],
  [0.66, 17],
  [0.72, 20],
  [0.78, 23],
  [0.83, 26],
  [0.87, 31],
];

/** Câmera que acompanha o caminhão na viagem: distância atrás (negativo = na frente), altura, deslocamento lateral e olhar à frente. */
/** Manobra de ré na doca do Cliente Horizonte. */
const DOCK_START = 0.958;
const DOCK_X = 386;
const DOCK_STAGE_Z = -376;
const DOCK_FINAL_Z = -360.6;

const CHASE_KEYS: { t: number; ahead: number; height: number; side: number; look: number }[] = [
  { t: 0.26, ahead: 26, height: 11, side: 6, look: 12 },
  { t: 0.34, ahead: 28, height: 13, side: -10, look: 14 },
  { t: 0.42, ahead: 30, height: 16, side: 14, look: 14 },
  { t: 0.47, ahead: 30, height: 17, side: 10, look: 12 },
  { t: 0.55, ahead: 27, height: 14, side: -12, look: 14 },
  { t: 0.61, ahead: 40, height: 38, side: 20, look: 16 },
  { t: 0.67, ahead: 34, height: 26, side: 12, look: 14 },
  { t: 0.73, ahead: 28, height: 16, side: 6, look: 14 },
  { t: 0.79, ahead: 30, height: 20, side: 10, look: 12 },
  { t: 0.86, ahead: 32, height: 22, side: 16, look: 10 },
];

/** Pontos iluminados da rota exibidos na cena. */
const ROUTE_POINTS: [number, number, number][] = [
  [-4.4, 0.32, 74],
  [-4.4, 0.32, -88],
  [-4.4, 0.32, -176],
  [17, 0.32, -203.2],
  [120, 0.32, -203.2],
  [236, 0.32, -203.2],
  [296.6, 0.32, -236],
  [296.6, 0.32, -342],
  [318, 0.32, -379.5],
  [402, 0.32, -357.5],
];

function makeShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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
    ctx.font = "500 18px Inter, sans-serif";
    ctx.fillText(row[1], 356, y + 29);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Inter, sans-serif";
    ctx.fillText(row[2], 468, y + 29);
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
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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

function makeContainerTexture(base: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 128);
  // ondulação lateral
  for (let x = 0; x < 256; x += 13) {
    ctx.fillStyle = "rgba(0,0,0,0.13)";
    ctx.fillRect(x, 12, 7, 98);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(x + 7, 12, 3, 98);
  }
  // travessas superior e inferior
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, 256, 12);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, 110, 256, 18);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(0, 104, 256, 4);
  // postes de canto
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, 7, 128);
  ctx.fillRect(249, 0, 7, 128);
  // marcação estêncil
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "bold 13px Arial";
  ctx.fillText("getTMS", 96, 60);
  ctx.fillText("22G1", 104, 78);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
function heightToNormalTexture(source: HTMLCanvasElement, strength = 2.4) {
  const w = source.width;
  const h = source.height;
  const sctx = source.getContext("2d")!;
  const data = sctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const out = ctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const left = lum[y * w + Math.max(0, x - 1)];
      const right = lum[y * w + Math.min(w - 1, x + 1)];
      const up = lum[Math.max(0, y - 1) * w + x];
      const down = lum[Math.min(h - 1, y + 1) * w + x];
      const nx = (left - right) * strength;
      const ny = (up - down) * strength;
      const len = Math.hypot(nx, ny, 1) || 1;
      const i4 = (y * w + x) * 4;
      out.data[i4] = ((nx / len) * 0.5 + 0.5) * 255;
      out.data[i4 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      out.data[i4 + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i4 + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
const normalCache = new WeakMap<object, THREE.Texture>();
function ensureNormal(tex: THREE.Texture): THREE.Texture | null {
  const stored = tex.userData.normal as THREE.Texture | undefined;
  const image = tex.image as HTMLCanvasElement | undefined;
  if (stored && stored.isTexture) {
    stored.repeat.copy(tex.repeat);
    return stored;
  }
  if (!image || !image.width) return null;
  let normal = normalCache.get(image);
  if (!normal) {
    normal = heightToNormalTexture(image);
    normalCache.set(image, normal);
  }
  normal.repeat.copy(tex.repeat);
  tex.userData.normal = normal;
  return normal;
}
function makeShopFacadeTexture(base: string, trim: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // textura de reboco
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // faixa do rodapé
  ctx.fillStyle = trim;
  ctx.fillRect(0, 232, 256, 24);
  // área lisa (canto superior esquerdo) usada nos tetos, sem janelas
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 34, 34);
  ctx.fillStyle = "rgba(52,58,52,0.16)";
  ctx.fillRect(0, 0, 34, 34);
  ctx.fillStyle = trim;
  ctx.fillRect(0, 30, 34, 4);
  // janelas em duas fileiras
  [64, 156].forEach((y) => {
    for (let x = 18; x < 240; x += 62) {
      ctx.fillStyle = trim;
      ctx.fillRect(x - 4, y - 4, 48, 44);
      const grad = ctx.createLinearGradient(x, y, x + 40, y + 36);
      grad.addColorStop(0, "#5b7f86");
      grad.addColorStop(0.55, "#2f4a4e");
      grad.addColorStop(1, "#3f6167");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, 40, 36);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x, y, 40, 3);
      ctx.fillStyle = trim;
      ctx.fillRect(x + 19, y, 2, 36);
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.userData.normal = heightToNormalTexture(canvas);
  return texture;
}
function makeStyledFacadeTexture(style: "glass" | "grid" | "ribbon", base: string, patch = "#b9bfb5") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i += 1) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  if (style === "glass") {
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(0, y, 256, 3);
      for (let x = 0; x < 256; x += 16) {
        const g = ctx.createLinearGradient(x, y, x, y + 29);
        g.addColorStop(0, "#7e9aa6");
        g.addColorStop(0.45, "#40606c");
        g.addColorStop(1, "#54727e");
        ctx.fillStyle = g;
        ctx.fillRect(x + 1, y + 3, 14, 26);
      }
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(0, y + 3, 256, 5);
    }
  } else if (style === "grid") {
    for (let y = 18; y < 250; y += 40) {
      for (let x = 12; x < 250; x += 36) {
        ctx.fillStyle = "rgba(70,90,96,0.9)";
        ctx.fillRect(x, y, 26, 26);
        const g = ctx.createLinearGradient(x, y, x + 26, y + 26);
        g.addColorStop(0, "#6f8c98");
        g.addColorStop(1, "#33494f");
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 2, 22, 22);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x + 2, y + 2, 22, 3);
      }
    }
  } else {
    for (let y = 16; y < 250; y += 30) {
      const g = ctx.createLinearGradient(0, y, 0, y + 16);
      g.addColorStop(0, "#6b8894");
      g.addColorStop(1, "#3c565f");
      ctx.fillStyle = g;
      ctx.fillRect(0, y, 256, 16);
      for (let x = 0; x < 256; x += 20) {
        ctx.fillStyle = "rgba(240,244,240,0.6)";
        ctx.fillRect(x, y, 2, 16);
      }
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(0, y - 2, 256, 2);
    }
  }
  // teto sem janelas
  ctx.fillStyle = patch;
  ctx.fillRect(0, 0, 34, 34);
  ctx.fillStyle = "rgba(52,58,52,0.16)";
  ctx.fillRect(0, 0, 34, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.userData.normal = heightToNormalTexture(canvas);
  texture.userData.style = style;
  return texture;
}
function makeWallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#f6f8f1";
  ctx.fillRect(0, 0, 256, 256);
  // ondulação do metal
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = "rgba(120,140,125,0.10)";
    ctx.fillRect(x, 0, 3, 256);
  }
  // faixa de janelas altas
  ctx.fillStyle = "rgba(46,64,54,0.72)";
  for (let x = 16; x < 240; x += 44) {
    ctx.fillRect(x, 34, 30, 30);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x, 34, 30, 8);
    ctx.fillStyle = "rgba(46,64,54,0.72)";
  }
  // linha de cinta e rodapé
  ctx.fillStyle = "rgba(90,110,95,0.22)";
  ctx.fillRect(0, 74, 256, 4);
  ctx.fillStyle = "rgba(90,110,95,0.18)";
  ctx.fillRect(0, 232, 256, 24);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
function makeShopSignTexture(label: string, bg: string, fg: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillStyle = fg;
  ctx.font = "700 62px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 62;
  while (ctx.measureText(label).width > 460 && size > 30) {
    size -= 4;
    ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
  }
  ctx.fillText(label, 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function makeFacadeTexture(wall: string, glass: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 10;
  const padX = 8;
  const padY = 10;
  const cellW = (128 - padX * 2) / cols;
  const cellH = (256 - padY * 2) / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = padX + c * cellW;
      const y = padY + r * cellH;
      // moldura clara + vidro escuro, com veneziana em algumas janelas
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(x + cellW * 0.1, y + cellH * 0.12, cellW * 0.8, cellH * 0.66);
      ctx.fillStyle = glass;
      ctx.fillRect(x + cellW * 0.16, y + cellH * 0.18, cellW * 0.68, cellH * 0.54);
      if (Math.random() > 0.72) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(x + cellW * 0.16, y + cellH * 0.18, cellW * 0.68, cellH * 0.26);
      }
      // peitoril
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(x + cellW * 0.08, y + cellH * 0.78, cellW * 0.84, cellH * 0.06);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.userData.normal = heightToNormalTexture(canvas);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.toneMappingExposure = 1.09;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c9e2);
  scene.fog = new THREE.FogExp2(0xe2edf5, 0.0014);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
  camera.position.set(38, 17, 42);

  const shadowTexture = makeShadowTexture();
  const disposables: { dispose: () => void }[] = [];
  // pooling de geometrias: uma malha base por dimensão, compartilhada por todos os veículos
  const geoCache = new Map<string, THREE.BufferGeometry>();
  function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const hit = geoCache.get(key);
    if (hit) return hit;
    const geo = make();
    geoCache.set(key, geo);
    return geo;
  }


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
    uLine: { value: new THREE.Color(0xdde2d3) },
    uBase: { value: new THREE.Color(0xe9ece1) },
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600, 1, 1),
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
    new THREE.PlaneGeometry(1700, 1700),
    new THREE.MeshStandardMaterial({ color: 0xeef2e6, roughness: 1, metalness: 0 }),
  );
  floorBase.rotation.x = -Math.PI / 2;
  floorBase.position.y = -0.06;
  scene.add(floorBase);
  // nuvens
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const cloudGeo = new THREE.SphereGeometry(1, 12, 10);
  // junta malhas estáticas que compartilham material: menos draw calls sem perder detalhe
  function mergeStatic(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const remove: THREE.Mesh[] = [];
    const world = new THREE.Matrix4();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || (mesh as unknown as { isSprite?: boolean }).isSprite || (mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return;
      if (!mesh.material || Array.isArray(mesh.material)) return;
      let node: THREE.Object3D | null = mesh;
      while (node && node !== root) {
        if (node.userData.dynamic) return;
        node = node.parent;
      }
      if (!mesh.geometry || !mesh.geometry.attributes.position) return;
      const src = mesh.geometry as THREE.BufferGeometry;
      if (src.attributes.color) return;
      let geo = (src.index ? src.toNonIndexed() : src.clone()) as THREE.BufferGeometry;
      ["position", "normal", "uv"].forEach((name) => {
        if (!geo.attributes[name]) return;
      });
      Object.keys(geo.attributes).forEach((name) => {
        if (name !== "position" && name !== "normal" && name !== "uv") geo.deleteAttribute(name);
      });
      const count = geo.attributes.position.count;
      if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      // normaliza tipos: modelos quantizados usam atributos normalizados e o merge falharia
      (["position", "normal", "uv"] as const).forEach((name) => {
        const attr = geo.attributes[name];
        if (!attr) return;
        const size = attr.itemSize;
        const data = new Float32Array(count * size);
        for (let i = 0; i < count * size; i += 1) data[i] = attr.array[i] as number;
        geo.setAttribute(name, new THREE.BufferAttribute(data, size));
      });
      geo.morphAttributes = {};
      world.multiplyMatrices(inv, mesh.matrixWorld);
      geo.applyMatrix4(world);
      const mat = mesh.material as THREE.Material;
      const bucket = byMat.get(mat);
      if (bucket) bucket.push(geo);
      else byMat.set(mat, [geo]);
      remove.push(mesh);
    });
    remove.forEach((mesh) => mesh.parent?.remove(mesh));
    byMat.forEach((geos, mat) => {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = "merged-static";
      root.add(mesh);
    });
  }

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
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9d3c2, 1.1);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.34);
  scene.add(ambient);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.35;
    room.dispose?.();
    pmrem.dispose();
  } catch {
    /* ambiente opcional */
  }
  const key = new THREE.DirectionalLight(0xfff8ec, 2.7);
  key.position.set(30, 50, 30);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xb8e88f, 0.6);
  rim.position.set(-40, 18, -34);
  scene.add(rim);

  const cool = new THREE.DirectionalLight(0xc3d2f2, 0.35);
  cool.position.set(8, 12, -60);
  scene.add(cool);

  // ---------------------------------------------------------------- clima
  // chuva: partículas que acompanham a câmera
  const RAIN_COUNT = low ? 900 : 2600;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(RAIN_COUNT * 3);
  const rainSpeeds = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 140;
    rainPositions[i * 3 + 1] = Math.random() * 60;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
    rainSpeeds[i] = 26 + Math.random() * 16;
  }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xcfe0ef,
    size: 0.34,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const dayBase = new THREE.Color(0xfff8ec);
  const duskBase = new THREE.Color(0xffb067);
  const nightBase = new THREE.Color(0x8fa6d8);
  const skyDay = new THREE.Color(0xa9c9e2);
  const skyDusk = new THREE.Color(0xe7a877);
  const skyNight = new THREE.Color(0x1d2740);
  const fogDay = new THREE.Color(0xe2edf5);
  const fogNight = new THREE.Color(0x2a3550);
  const tmpColor = new THREE.Color();
  let weatherMode: "auto" | "day" | "night" | "rain" = "auto";
  let weatherP = 0;
  let weatherRain = 0;
  let lastWeatherTime = -1;
  function applyWeather(p: number, time: number) {
    const dt = lastWeatherTime < 0 ? 0.016 : Math.min(0.2, Math.max(0.001, time - lastWeatherTime));
    lastWeatherTime = time;
    let targetP = p;
    let targetRain = range(p, 0.58, 0.64) * (1 - range(p, 0.8, 0.86));
    if (weatherMode === "day") {
      targetP = 0.06;
      targetRain = 0;
    } else if (weatherMode === "night") {
      targetP = 1;
      targetRain = 0;
    } else if (weatherMode === "rain") {
      targetP = 0.8;
      targetRain = 1;
    }
    const ease = Math.min(1, dt * 1.8);
    weatherP += (targetP - weatherP) * ease;
    weatherRain += (targetRain - weatherRain) * ease;
    const wp = weatherP;
    // 0 = dia, 1 = noite (anoitece na periferia, chega no cliente à noite)
    const dusk = range(wp, 0.42, 0.6);
    const night = range(wp, 0.6, 0.82);
    const lightMix = dusk * 0.55 + night * 0.45;
    tmpColor.copy(dayBase).lerp(duskBase, dusk).lerp(nightBase, night);
    key.color.copy(tmpColor);
    key.intensity = 2.7 * (1 - 0.55 * dusk) * (1 - 0.72 * night);
    rim.intensity = 0.6 * (1 - 0.5 * night);
    cool.intensity = 0.35 + night * 0.55;
    hemi.intensity = 1.1 * (1 - 0.68 * night) * (1 - 0.15 * dusk);
    ambient.intensity = 0.34 + night * 0.2;
    const skyMat = sky.material as THREE.ShaderMaterial;
    skyMat.uniforms.uTop.value.set(0x8fb8d8).lerp(tmpColor.set(0x4b5f96), dusk).lerp(tmpColor.set(0x0b1226), night);
    skyMat.uniforms.uBottom.value.set(0xdcebf5).lerp(tmpColor.set(0xf2b27a), dusk).lerp(tmpColor.set(0x2b3550), night);
    key.position.set(30 - lightMix * 50, 50 - lightMix * 26, 30 + lightMix * 20);
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(skyDay).lerp(skyDusk, dusk).lerp(skyNight, night);
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(fogDay).lerp(skyDusk, dusk * 0.7).lerp(fogNight, night);
      scene.fog.density = 0.0014 + night * 0.0006;
    }
    // chuva (automática no trecho rural/periferia ou ligada no controle)
    const rainIn = weatherRain;
    rainMat.opacity = rainIn * 0.6;
    rain.visible = rainIn > 0.01;
    if (rain.visible && frameCount % 2 === 0) {
      const arr = rainGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        const yi = i * 3 + 1;
        arr[yi] -= rainSpeeds[i] * 0.016;
        if (arr[yi] < 0) {
          arr[yi] += 60;
          arr[i * 3] = (Math.random() - 0.5) * 140;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 140;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
      rain.position.set(camera.position.x, 0, camera.position.z);
    }
    if (rainIn > 0.35) {
      hemi.intensity *= 1 - 0.18 * rainIn;
      key.intensity *= 1 - 0.22 * rainIn;
    }
  }
  // ---------------------------------------------------------------- morros
  const hillMat = new THREE.MeshStandardMaterial({ color: 0xd8e0cc, roughness: 0.95, metalness: 0 });
  const hillGeo = new THREE.SphereGeometry(1, 20, 14);
  const hills = new THREE.Group();
  for (let i = 0; i < 11; i += 1) {
    const hill = new THREE.Mesh(hillGeo, hillMat);
    const r = 30 + Math.random() * 40;
    hill.scale.set(r * 1.7, r * 0.34, r * 1.4);
    hill.position.set(-420 + i * 84 + Math.random() * 24, -r * 0.16, -500 - Math.random() * 90);
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
    color: 0x4a5150,
    roughness: 0.9,
    metalness: 0.12,
    transparent: true,
    opacity: 0,
  });
  const asphalt = new THREE.Mesh(round(12, 0.3, 286, 0.12, 2), asphaltMat);
  asphalt.position.set(0, 0.1, -43);
  road.add(asphalt);

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xf3f6ee,
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    opacity: 0,
  });
  [-6.3, 6.3].forEach((x) => {
    const curb = new THREE.Mesh(round(0.55, 0.34, 286, 0.14, 2), curbMat);
    curb.position.set(x, 0.16, -43);
    road.add(curb);
  });

  const edgeMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0 });
  [-5.7, 5.7].forEach((x) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 286), edgeMat);
    edge.position.set(x, 0.27, -43);
    road.add(edge);
  });

  // malha viária conectada
  const gridRoadMat = new THREE.MeshStandardMaterial({
    color: 0x767d7a,
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
  [-210, -150, -60, 64, 128, 190, 250].forEach((x) => addStreet(x, 20, 380, false));
  addStreet(0, -52, 180, false);
  addStreet(0, 6, 120, false);
  // calcadas e meio-fio nas ruas transversais
  const gridWalkMat = new THREE.MeshStandardMaterial({ color: 0xe9ebe3, roughness: 0.95 });
  const gridCurbMat = new THREE.MeshStandardMaterial({ color: 0xd2d5cb, roughness: 0.9 });
  const addGridWalks = (x: number, z: number, length: number, horizontal: boolean) => {
    [-1, 1].forEach((side) => {
      const walk = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? length : 2.4, 0.2, horizontal ? 2.4 : length),
        gridWalkMat,
      );
      walk.position.set(horizontal ? x : x + side * 5.7, 0.1, horizontal ? z + side * 5.7 : z);
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? length : 0.22, 0.3, horizontal ? 0.22 : length),
        gridCurbMat,
      );
      curb.position.set(horizontal ? x : x + side * 4.55, 0.15, horizontal ? z + side * 4.55 : z);
      scene.add(walk, curb);
    });
  };
  [-150, -96, 30, 84, 138, 192].forEach((z) => addGridWalks(0, z, 420, true));
  [-210, -150, -60, 64, 128, 190, 250].forEach((x) => addGridWalks(x, 20, 380, false));
  addGridWalks(0, -52, 180, false);
  addGridWalks(0, 6, 120, false);

  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7fff0, transparent: true, opacity: 0 });
  const dashCount = 96;
  const dashes = new THREE.InstancedMesh(round(0.2, 0.05, 3, 0.06, 1), dashMat, dashCount);
  const dashDummy = new THREE.Object3D();
  for (let i = 0; i < dashCount; i += 1) {
    dashDummy.position.set(i % 2 === 0 ? -3 : 3, 0.27, 88 - Math.floor(i / 2) * 5.8);
    dashDummy.updateMatrix();
    dashes.setMatrixAt(i, dashDummy.matrix);
  }
  road.add(dashes);
  // eixo duplo da avenida
  [-0.16, 0.16].forEach((x) => {
    const axis = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 274), dashMat);
    axis.position.set(x, 0.27, -39);
    road.add(axis);
  });

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

  const wallMat = new THREE.MeshStandardMaterial({ map: track(makeWallTexture()), color: 0xffffff, roughness: 0.7, metalness: 0.12 });
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
    const crateHex = crateColors[layout.color % crateColors.length].toString(16).padStart(6, "0");
    const mat = new THREE.MeshStandardMaterial({
      map: makeContainerTexture(`#${crateHex}`),
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
    if (false && index < 3) {
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
    track(makeStyledFacadeTexture("grid", "#eef1ec")),
    track(makeStyledFacadeTexture("ribbon", "#e2e7ea")),
    track(makeStyledFacadeTexture("glass", "#5d7c86")),
    track(makeFacadeTexture("#e6ecdf", "rgba(30,44,34,0.6)")),
    track(makeStyledFacadeTexture("grid", "#e4eae2")),
  ];

  const shopNames = [
    "Mercado Bom Preço",
    "Farmácia Saúde",
    "Padaria Pão Quente",
    "Lanches do Zé",
    "Ótica Visão",
    "Papelaria Central",
    "Barbearia Lima",
    "Peças & Cia",
    "Café Avenida",
    "Tecidos Silva",
    "Açougue Ideal",
    "Loja Verde",
    "Presentes Amor",
    "Auto Peças BR",
    "Casa & Cia",
    "Bebidas Geladas",
  ];
  const shopSignBgs = ["#3f7d34", "#c0563c", "#2f5f8a", "#b8862f", "#4a4f58", "#7a3f6d"];
  const shopAwnings = [0xd8dfd2, 0xc9d6c0, 0xe2d3b8, 0xc8d2dc, 0xd9c9c2];
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
    { x: 62, z: -22, w: 11, d: 11, h: 34 },
    { x: 70, z: 18, w: 9, d: 9, h: 22 },
    { x: 46, z: 40, w: 10, d: 10, h: 26 },
    { x: 18, z: 44, w: 9, d: 9, h: 18 },
    { x: -12, z: 46, w: 10, d: 10, h: 24 },
    { x: -46, z: 46, w: 9, d: 9, h: 16 },
    { x: -62, z: -46, w: 10, d: 10, h: 28 },
    { x: -24, z: -50, w: 12, d: 12, h: 32 },
    { x: 10, z: -52, w: 10, d: 10, h: 20 },
    { x: 44, z: -46, w: 9, d: 9, h: 24 },
    { x: 78, z: -4, w: 10, d: 10, h: 30 },
    { x: -74, z: 30, w: 9, d: 9, h: 18 },
    { x: 30, z: 60, w: 11, d: 11, h: 28 },
    { x: -30, z: 62, w: 10, d: 10, h: 22 },
    { x: 66, z: 52, w: 9, d: 9, h: 20 },
  ];

  // horizonte distante
  const skyline = new THREE.Group();
  for (let i = 0; i < 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2 + Math.sin(i) * 0.06;
    let radius = 200 + ((i * 37) % 150);
    const w = 8 + ((i * 13) % 14);
    const h = 16 + ((i * 29) % 62);
    // o setor sul é o trecho rural e o cliente: a cidade distante vai para o horizonte
    if (Math.sin(angle) < -0.25) radius = 620 + ((i * 23) % 130);
    const facade = facadeTextures[i % facadeTextures.length].clone();
    facade.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(2, Math.round(h / 8)));
    facade.needsUpdate = true;
    const towerPalette = [0xd7e0e8, 0xe9e2d2, 0xf2f4ef, 0xccd6ce, 0xdfd9d2];
    const skyGlass = (facade.userData.style as string) === "glass";
    const skyNormal = ensureNormal(facade);
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.9),
      new THREE.MeshStandardMaterial({
        map: facade,
        color: towerPalette[i % towerPalette.length],
        roughness: skyGlass ? 0.22 : 0.65,
        metalness: skyGlass ? 0.4 : 0.12,
        ...(skyNormal ? { normalMap: skyNormal, normalScale: new THREE.Vector2(0.45, 0.45) } : {}),
      }),
    );
    const towerX = Math.cos(angle) * radius;
    const towerZ = Math.sin(angle) * radius - 60;
    // não deixa torre do horizonte cair sobre a rota do caminhão
    let routeGap = Infinity;
    for (let k = 0; k < HERO_ROUTE.length - 1; k += 1) {
      const [ax, az] = HERO_ROUTE[k];
      const [bx, bz] = HERO_ROUTE[k + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((towerX - ax) * dx + (towerZ - az) * dz) / len2));
      const px = ax + dx * t;
      const pz = az + dz * t;
      routeGap = Math.min(routeGap, Math.hypot(towerX - px, towerZ - pz));
    }
    if (routeGap < 30 + w / 2) continue;
    tower.position.set(towerX, h / 2 - 2, towerZ);
    skyline.add(tower);
    // detalhes de cobertura: caixa d'água, casa de máquinas ou antena
    if (i % 3 === 0) {
      const roofBox = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.32, 1.6, w * 0.3),
        new THREE.MeshStandardMaterial({ color: 0xb9c2bd, roughness: 0.9 }),
      );
      roofBox.position.set(tower.position.x + w * 0.15, h - 1.2, tower.position.z);
      skyline.add(roofBox);
    } else if (i % 5 === 0) {
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0x8d9a93, roughness: 0.8 }),
      );
      antenna.position.set(tower.position.x - w * 0.2, h + 0.2, tower.position.z + w * 0.1);
      skyline.add(antenna);
    }
  }
  scene.add(skyline);
  const routeGapAt = (x: number, z: number) => {
    let best = Infinity;
    let nx = x;
    let nz = z;
    for (let k = 0; k < HERO_ROUTE.length - 1; k += 1) {
      const [ax, az] = HERO_ROUTE[k];
      const [bx, bz] = HERO_ROUTE[k + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
      const px = ax + dx * t;
      const pz = az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) {
        best = d;
        nx = px;
        nz = pz;
      }
    }
    return { gap: best, px: nx, pz: nz };
  };
  const boxTowers: THREE.Mesh[] = [];
  towerLayout.forEach((tower, index) => {
    const pick = [3, 1, 2, 5, 3, 1][index % 6];
    const texture = facadeTextures[pick].clone();
    texture.repeat.set(Math.max(1, Math.round(tower.w / 8)), Math.max(2, Math.round(tower.h / 12)));
    texture.needsUpdate = true;
    const style = (texture.userData.style as string) || "classic";
    const glass = style === "glass";
    const towerNormal = ensureNormal(texture);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      ...(towerNormal ? { normalMap: towerNormal, normalScale: new THREE.Vector2(glass ? 0.3 : 0.4, glass ? 0.3 : 0.4) } : {}),
      roughness: glass ? 0.16 : style === "classic" ? 0.8 : 0.35,
      metalness: glass ? 0.5 : style === "classic" ? 0.1 : 0.22,
      color: glass ? 0xbcd2da : 0xffffff,
    });
    const mesh = new THREE.Mesh(round(tower.w, tower.h, tower.d, 0.35, 2), mat);
    mesh.position.set(tower.x, tower.h / 2, tower.z);
    mesh.scale.y = 0.001;
    city.add(mesh);
    // recuo escalonado nos prédios altos (silhueta moderna)
    if (tower.h >= 22) {
      const tierH = tower.h * 0.34;
      const tier = new THREE.Mesh(round(tower.w * 0.68, tierH, tower.d * 0.68, 0.3, 2), mat);
      tier.position.set(tower.x, tower.h + tierH / 2, tower.z);
      tier.scale.y = 0.001;
      city.add(tier);
      mesh.userData.tier = tier;
      mesh.userData.tierH = tierH;
    }
    const cap = new THREE.Mesh(round(tower.w * 0.6, 0.6, tower.d * 0.6, 0.2, 2), unitMat);
    cap.position.set(tower.x, tower.h + 0.3, tower.z);
    cap.scale.y = 0.001;
    city.add(cap);
    towers.push({ mesh, height: tower.h, delay: index * 0.03 });
    mesh.userData.cap = cap;
    boxTowers[index] = mesh;

    // térreo comercial: vitrine, toldo e placa com nome da loja
    if (Math.abs(tower.x) >= 12 && tower.z > -30) {
      const side = tower.x < 0 ? 1 : -1;
      const faceX = tower.x + side * (tower.w / 2 + 0.08);
      const shopW = Math.min(tower.w * 0.8, 7.2);
      const glassShop = new THREE.Mesh(
        new THREE.PlaneGeometry(shopW, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x2c3a33, roughness: 0.25, metalness: 0.55 }),
      );
      glassShop.position.set(faceX, 1.45, tower.z);
      glassShop.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      city.add(glassShop);

      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.12, shopW + 0.5),
        new THREE.MeshStandardMaterial({ color: shopAwnings[index % shopAwnings.length], roughness: 0.85 }),
      );
      awning.position.set(faceX + side * 0.45, 3.05, tower.z);
      awning.rotation.z = side * -0.16;
      city.add(awning);

      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(shopW, shopW * 0.25),
        new THREE.MeshBasicMaterial({ map: track(makeShopSignTexture(shopNames[index % shopNames.length], shopSignBgs[index % shopSignBgs.length], "#ffffff")) }),
      );
      sign.position.set(faceX + side * 0.02, 3.75, tower.z);
      sign.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      city.add(sign);
    }
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
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x5a615f, roughness: 0.95 });
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
  // calcadas continuas com meio-fio ao longo da avenida
  const sidewalkCanvas = document.createElement("canvas");
  sidewalkCanvas.width = 128;
  sidewalkCanvas.height = 128;
  {
    const ctx = sidewalkCanvas.getContext("2d")!;
    ctx.fillStyle = "#e9ebe3";
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) {
      for (let x = 0; x < 128; x += 32) {
        ctx.fillStyle = (x / 32 + y / 32) % 2 === 0 ? "#dfe3d8" : "#eaede3";
        ctx.fillRect(x + 1, y + 1, 30, 30);
      }
    }
    ctx.strokeStyle = "rgba(104,112,102,0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
  }
  const sidewalkTexture = new THREE.CanvasTexture(sidewalkCanvas);
  sidewalkTexture.colorSpace = THREE.SRGBColorSpace;
  sidewalkTexture.wrapS = THREE.RepeatWrapping;
  sidewalkTexture.wrapT = THREE.RepeatWrapping;
  sidewalkTexture.repeat.set(1.6, 5);
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture, roughness: 0.95 });
  const avenueCurbMat = new THREE.MeshStandardMaterial({ color: 0xd2d5cb, roughness: 0.9 });
  const sidewalkGroup = new THREE.Group();
  for (let z = -150; z <= 92; z += 10) {
    [-1, 1].forEach((side) => {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 9.8), sidewalkMat);
      walk.position.set(side * 7.7, 0.11, z);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 9.8), avenueCurbMat);
      curb.position.set(side * 6.32, 0.17, z);
      sidewalkGroup.add(walk, curb);
    });
  }
  scene.add(sidewalkGroup);

  // comercio de rua: lojas e predios comerciais
  const shopWallMats = [0xf4f5ef, 0xe8ebe2, 0xdfe4da, 0xf0ede4].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }),
  );
  const shopGlassMat = new THREE.MeshStandardMaterial({ color: 0x4b5a63, roughness: 0.25, metalness: 0.5 });
  const awningMats = [0x63b32e, 0x2f6f4f, 0xd9b23a, 0x8fd14f].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }),
  );
  const signMat = new THREE.MeshBasicMaterial({ color: 0xf7fff0 });
  const avenueShopNames = [
    "Padaria do Bairro",
    "Mercado São José",
    "Farmácia Popular",
    "Açaí & Cia",
    "Lanches Avenida",
    "Ótica Central",
    "Papelaria Nova",
    "Barbearia Estilo",
    "Peças & Serviços",
    "Café da Esquina",
    "Tecidos União",
    "Pet Shop Amigo",
    "Loja Verde",
    "Bebidas Frias",
    "Eletro Lar",
    "Presentes & Cia",
    "Auto Center BR",
    "Hortifruti Bom",
    "Sorveteria Gelato",
    "Casa do Pão",
  ];
  const avenueSignBgs = ["#3f7d34", "#c0563c", "#2f5f8a", "#b8862f", "#4a4f58", "#7a3f6d"];
  const shopWallColors = ["#e9e2d2", "#dfe4da", "#f0ede4", "#e3dccb", "#dbe3d2", "#ece3d6"];
  const shopTrimColors = ["#c9c2b2", "#b9c2bd", "#cfc6b4", "#c4bda9", "#bcc7be", "#cbc2b2"];
  const shopTrimMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c6, roughness: 0.9 });
  const shopAcMat = new THREE.MeshStandardMaterial({ color: 0xcfd6d2, roughness: 0.6, metalness: 0.3 });
  const shopTankMat = new THREE.MeshStandardMaterial({ color: 0x3f6b8a, roughness: 0.6, metalness: 0.2 });
  const addShop = (x: number, z: number, w: number, d: number, h: number, face: number, i: number) => {
    const g = new THREE.Group();
    const facade = makeShopFacadeTexture(shopWallColors[i % shopWallColors.length], shopTrimColors[i % shopTrimColors.length]);
    facade.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 7)));
    const shopNormal = ensureNormal(facade);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: facade,
      roughness: 0.85,
      metalness: 0.05,
      ...(shopNormal ? { normalMap: shopNormal, normalScale: new THREE.Vector2(0.5, 0.5) } : {}),
    });
    const body = new THREE.Mesh(round(w, h, d, 0.18, 1), bodyMat);
    body.position.y = h / 2;
    const glass = new THREE.Mesh(round(w * 0.82, h * 0.34, 0.16, 0.06, 1), shopGlassMat);
    glass.position.set(0, h * 0.28, (d / 2 + 0.06) * face);
    const awning = new THREE.Mesh(round(w * 0.92, 0.12, 1.5, 0.05, 1), awningMats[i % awningMats.length]);
    awning.position.set(0, h * 0.56, (d / 2 + 0.6) * face);
    awning.rotation.x = face > 0 ? -0.14 : 0.14;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.72, w * 0.72 * 0.25),
      new THREE.MeshBasicMaterial({
        map: track(makeShopSignTexture(avenueShopNames[i % avenueShopNames.length], avenueSignBgs[i % avenueSignBgs.length], "#ffffff")),
      }),
    );
    sign.position.set(0, h * 0.78, (d / 2 + 0.09) * face);
    if (face < 0) sign.rotation.y = Math.PI;
    // cobertura: caixa d'água, ar-condicionado e platibanda
    const parapet = new THREE.Mesh(round(w + 0.2, 0.45, d + 0.2, 0.1, 1), shopTrimMat);
    parapet.position.y = h + 0.2;
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1), shopAcMat);
    ac.position.set(-w * 0.18, h + 0.62, d * 0.1);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.5, 14), shopTankMat);
    tank.position.set(w * 0.22, h + 0.95, -d * 0.15);
    g.add(body, glass, awning, sign, parapet, ac, tank);
    g.position.set(x, 0, z);
    scene.add(g);
  };
  const shopRows: Array<[number, number, number]> = [
    [-30, 58, 0], [-14, 58, 0], [16, 58, 0], [32, 58, 0],
    [-34, 20, 0], [-18, 20, 0], [18, 20, 0], [34, 20, 0],
    [-32, -20, 0], [-16, -20, 0], [16, -20, 0], [32, -20, 0],
    [-30, -74, 0], [-14, -74, 0], [18, -74, 0], [34, -74, 0],
    [-30, 108, 0], [16, 108, 0], [46, 30, 1], [-46, 30, 1],
  ];
  shopRows.forEach(([sx, sz, f], i) => {
    addShop(sx, sz, 8 + (i % 3), 8 + ((i + 1) % 3), 6 + (i % 4) * 2.5, f === 0 ? -1 : 1, i);
  });
  // mobiliário urbano: bancos, lixeiras, hidrantes, placas e parada de ônibus
  const benchWood = new THREE.MeshStandardMaterial({ color: 0x9a6b45, roughness: 0.85 });
  const streetMetal = new THREE.MeshStandardMaterial({ color: 0x46514b, roughness: 0.5, metalness: 0.55 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4f, roughness: 0.7, metalness: 0.2 });
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.55 });
  const makeSpeedSign = (limit: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#f7f8f3";
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#2b332c";
    ctx.font = "bold 58px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(limit, 64, 68);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const speedTexture = makeSpeedSign("40");
  for (let z = -132; z <= 96; z += 38) {
    [-1, 1].forEach((side) => {
      if (Math.abs(z - 52) < 22) return;
      const x = side * 8.55;
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.62), benchWood);
      seat.position.y = 0.46;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.12), benchWood);
      back.position.set(0, 0.72, -0.26);
      bench.add(seat, back);
      [-0.88, 0.88].forEach((dx) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.52), streetMetal);
        leg.position.set(dx, 0.23, 0);
        bench.add(leg);
      });
      bench.position.set(x, 0.22, z);
      bench.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(bench);
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.86, 12), binMat);
      bin.position.set(x, 0.65, z + 2.6);
      const binRim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 14), streetMetal);
      binRim.rotation.x = Math.PI / 2;
      binRim.position.set(x, 1.08, z + 2.6);
      scene.add(bin, binRim);
      if (Math.abs(z) % 76 < 1) {
        const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.72, 12), hydrantMat);
        hydrant.position.set(x, 0.58, z - 3.4);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), hydrantMat);
        cap.position.set(x, 0.95, z - 3.4);
        scene.add(hydrant, cap);
      }
      if (Math.abs(z + 56) < 1 || Math.abs(z - 58) < 1) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), streetMetal);
        pole.position.set(x - side * 0.35, 1.52, z);
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(0.9, 0.9),
          new THREE.MeshStandardMaterial({ map: speedTexture, roughness: 0.7 }),
        );
        plate.position.set(x - side * 0.35, 2.5, z + (side > 0 ? -0.05 : 0.05));
        plate.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        scene.add(pole, plate);
      }
    });
  }
  // parada de ônibus coberta
  const avenueBusStop = new THREE.Group();
  const shelterGlassMat = new THREE.MeshStandardMaterial({ color: 0x9fc0c6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.45 });
  const shelterRoof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 4.6), streetMetal);
  shelterRoof.position.set(0, 2.6, 0);
  const shelterGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 4.4), shelterGlassMat);
  shelterGlass.position.set(0.86, 1.35, 0);
  const shelterBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 4.4), shelterGlassMat);
  shelterBack.position.set(-0.86, 1.4, 0);
  const shelterBench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 3.2), benchWood);
  shelterBench.position.set(-0.5, 0.55, 0);
  [-2.1, 2.1].forEach((dz) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.55, 8), streetMetal);
    post.position.set(0.86, 1.28, dz);
    avenueBusStop.add(post);
  });
  const busSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.5),
    new THREE.MeshBasicMaterial({ map: track(makeShopSignTexture("PONTO · LINHA 22", "#2f5f8a", "#ffffff")) }),
  );
  busSign.position.set(1.0, 2.1, 0);
  busSign.rotation.y = -Math.PI / 2;
  avenueBusStop.add(shelterRoof, shelterGlass, shelterBack, shelterBench, busSign);
  avenueBusStop.position.set(8.2, 0.22, 52);
  scene.add(avenueBusStop);
  // torres com modelos de catálogo (CC0) no lugar das caixas
  {
    const bldLoader = new GLTFLoader();
    const bldKeys = ["bld-skyscraper", "bld-office", "bld-apartment"];
    bldKeys.forEach((key, modelIndex) => {
      bldLoader.load(
        `${import.meta.env.BASE_URL}models/${key}.glb`,
        (gltf) => {
          const proto = gltf.scene;
          const slabs: THREE.Object3D[] = [];
          proto.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = false;
              mesh.receiveShadow = false;
            }
            if (/ground_slab|ground_slab_/i.test(o.name)) slabs.push(o);
          });
          slabs.forEach((o) => o.parent?.remove(o));
          // paleta alinhada à cidade (o modelo original vem com tons salmão na textura)
          if (key === "bld-apartment") {
            const calmTexture = (texture: THREE.Texture | null, keep = 0.12): THREE.Texture | null => {
              if (!texture || !texture.image) return texture;
              try {
                const image = texture.image as HTMLImageElement;
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
                ctx.drawImage(image, 0, 0);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const px = data.data;
                for (let i = 0; i < px.length; i += 4) {
                  const r = px[i] / 255;
                  const g = px[i + 1] / 255;
                  const b = px[i + 2] / 255;
                  const max = Math.max(r, g, b);
                  const min = Math.min(r, g, b);
                  const l = (max + min) / 2;
                  if (l < 0.55 || l > 0.97) continue;
                  const grey = l;
                  px[i] = (grey + (r - grey) * keep) * 255;
                  px[i + 1] = (grey + (g - grey) * keep) * 255;
                  px[i + 2] = (grey + (b - grey) * keep) * 255;
                }
                ctx.putImageData(data, 0, 0);
                const out = new THREE.CanvasTexture(canvas);
                out.colorSpace = texture.colorSpace;
                out.flipY = texture.flipY;
                out.wrapS = texture.wrapS;
                out.wrapT = texture.wrapT;
                out.needsUpdate = true;
                return out;
              } catch {
                return texture;
              }
            };
            proto.traverse((o) => {
              const mesh = o as THREE.Mesh;
              if (!mesh.isMesh) return;
              const std = (mesh.material as THREE.MeshStandardMaterial).clone();
              const name = (std.name || "").toLowerCase();
              if (name.includes("mint")) std.map = calmTexture(std.map, 0.3);
              else if (name.includes("wood")) std.map = calmTexture(std.map, 0.45);
              else if (!name.includes("glass")) std.map = calmTexture(std.map, 0.1);
              std.color.set(0xffffff);
              mesh.material = std;
            });
          }
          const bbox = new THREE.Box3().setFromObject(proto);
          const size = bbox.getSize(new THREE.Vector3());
          const center = bbox.getCenter(new THREE.Vector3());
          towerLayout.forEach((tower, index) => {
            if (index % bldKeys.length !== modelIndex) return;
            const clone = proto.clone(true);
            clone.position.set(-center.x, -bbox.min.y, -center.z);
            const holder = new THREE.Group();
            holder.add(clone);
            // limita cada eixo ao lote para o prédio não invadir a rua
            const fit = Math.min(
              tower.h / size.y,
              (tower.w * 1.02) / size.x,
              (tower.d * 1.02) / size.z,
            );
            holder.scale.setScalar(fit);
            // garante folga da pista: empurra a torre para fora da rota
            const half = 0.5 * Math.max(size.x, size.z) * fit;
            const { gap, px, pz } = routeGapAt(tower.x, tower.z);
            const need = 12 + half;
            let hx = tower.x;
            let hz = tower.z;
            if (gap < need) {
              const dx = tower.x - px;
              const dz = tower.z - pz;
              const d = Math.hypot(dx, dz) || 1;
              hx = px + (dx / d) * need;
              hz = pz + (dz / d) * need;
            }
            // avenida central tem 24 de largura: nada dentro dela
            const avenueEdge = 12 + half + 2;
            if (Math.abs(hx) < avenueEdge) hx = (hx < 0 ? -1 : 1) * avenueEdge;
            // corredor da via expressa (z entre -214 e -182)
            if (hz < -182 && hz > -214) hz = hz > -198 ? -181 : -215;
            // e também longe das ruas do grid (faixas de 20 de largura)
            [-210, -150, -60, 64, 128, 190, 250].forEach((streetX) => {
              const clearance = 10 + half + 2;
              if (Math.abs(hx - streetX) < clearance) {
                hx = streetX + (hx >= streetX ? clearance : -clearance);
              }
            });
            holder.position.set(hx, 0, hz);
            holder.rotation.y = ((index * 3) % 4) * (Math.PI / 2);
            city.add(holder);
            const box = boxTowers[index];
            if (box) {
              box.visible = false;
              const cap = box.userData.cap as THREE.Mesh | undefined;
              const tier = box.userData.tier as THREE.Mesh | undefined;
              if (cap) cap.visible = false;
              if (tier) tier.visible = false;
            }
          });
        },
        undefined,
        () => {
          /* sem modelo: as caixas continuam como estão */
        },
      );
    });
  }
  // preenchimento das quadras vazias: prédios baixos, praça, estacionamento e árvores
  {
    let seed = 20261111;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const occupied: [number, number][] = [];
    towerLayout.forEach((t) => occupied.push([t.x, t.z]));
    shopRows.forEach(([x, z]) => occupied.push([x, z]));
    occupied.push([15, -16], [0, 84], [-40, 84], [0, 40]);
    const facadePool = [
      makeStyledFacadeTexture("ribbon", "#e6eaec", "#c3c9c6"),
      makeStyledFacadeTexture("grid", "#eef1ec", "#c3c9c6"),
      makeShopFacadeTexture("#e9e2d2", "#c9c2b2"),
      makeStyledFacadeTexture("glass", "#5d7c86", "#b9bfb5"),
      makeStyledFacadeTexture("ribbon", "#dfe3e4", "#b9bfb5"),
      makeShopFacadeTexture("#ecebe3", "#bdb6a6"),
    ];
    // tudo o que é estático entra em buckets e vira poucos meshes (menos draw calls)
    const buildingBuckets: THREE.BufferGeometry[][] = [[], [], [], [], [], []];
    const parapetBucket: THREE.BufferGeometry[] = [];
    const roofBucket: THREE.BufferGeometry[] = [];
    const trunkBucket: THREE.BufferGeometry[] = [];
    const crownBucket: THREE.BufferGeometry[] = [];
    const plainRoofUv = (geo: THREE.BufferGeometry, ru: number, rv: number) => {
      const normal = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
      const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
      if (!normal || !uv) return geo;
      for (let i = 0; i < normal.count; i += 1) {
        if (Math.abs(normal.getY(i)) > 0.5) uv.setXY(i, 0.06 / ru, 0.06 / rv);
      }
      uv.needsUpdate = true;
      return geo;
    };
    const bakeUv = (geo: THREE.BufferGeometry, ru: number, rv: number) => {
      const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
      if (!uv) return geo;
      for (let i = 0; i < uv.count; i += 1) {
        uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
      }
      uv.needsUpdate = true;
      return geo;
    };
    const place = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
      geo.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z));
      return geo;
    };
    const contactTex = (() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const grad = ctx.createRadialGradient(32, 32, 6, 32, 32, 32);
      grad.addColorStop(0, "rgba(18,24,20,0.34)");
      grad.addColorStop(0.55, "rgba(18,24,20,0.18)");
      grad.addColorStop(1, "rgba(18,24,20,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })();
    const contactBucket: THREE.BufferGeometry[] = [];
    const roofDeckBucket: THREE.BufferGeometry[] = [];
    const plinthBucket: THREE.BufferGeometry[] = [];
    const parkCenter: [number, number] = [-64, 46];
    const lotCenter: [number, number] = [40, -96];
    const fill = (x: number, z: number, w: number, h: number, d: number, variant: number) => {
      const body = round(w, h, d, 0.22, 1);
      const ru = Math.max(1, Math.round(w / 6));
      const rv = Math.max(1, Math.round(h / 7));
      bakeUv(body, ru, rv);
      plainRoofUv(body, ru, rv);
      buildingBuckets[variant % buildingBuckets.length].push(place(body, x, h / 2, z));
      parapetBucket.push(place(round(w + 0.3, 0.4, d + 0.3, 0.1, 1), x, h + 0.18, z));
      roofDeckBucket.push(place(new THREE.BoxGeometry(w - 0.25, 0.1, d - 0.25), x, h + 0.07, z));
      plinthBucket.push(place(new THREE.BoxGeometry(w + 0.14, 0.55, d + 0.14), x, 0.27, z));
      const contact = new THREE.PlaneGeometry(w + 3.5, d + 3.5);
      contact.rotateX(-Math.PI / 2);
      contactBucket.push(place(contact, x, 0.075, z));
      roofBucket.push(place(new THREE.BoxGeometry(1.6, 0.9, 1.3), x + w * 0.18, h + 0.65, z - d * 0.15));
      // árvores na esquina do lote
      if (rand() > 0.35) {
        const tx = x + (rand() > 0.5 ? w / 2 + 2.2 : -w / 2 - 2.2);
        const tz = z + (rand() > 0.5 ? d / 2 + 2 : -d / 2 - 2);
        trunkBucket.push(place(new THREE.CylinderGeometry(0.22, 0.28, 2.2, 7), tx, 1.1, tz));
        crownBucket.push(place(new THREE.IcosahedronGeometry(1.6 + rand() * 0.6, 1), tx, 2.9 + rand() * 0.4, tz));
      }
    };
    const isFree = (x: number, z: number, radius: number) =>
      occupied.every(([ox, oz]) => Math.hypot(ox - x, oz - z) > radius);
    for (let gx = -88; gx <= 88; gx += 15) {
      if (Math.abs(gx) < 18) continue;
      for (let gz = -128; gz <= 112; gz += 16) {
        if (gz > -30 && gz < 30 && Math.abs(gx) < 34) continue; // corredor do CD e avenida
        if (Math.hypot(gx - parkCenter[0], gz - parkCenter[1]) < 18) continue;
        if (Math.hypot(gx - lotCenter[0], gz - lotCenter[1]) < 18) continue;
        if (gx > 120) continue;
        if (!isFree(gx, gz, 9.5)) continue;
        if (rand() < 0.42) continue; // deixa terrenos livres (praças, quintais)
        const w = 8 + Math.floor(rand() * 5);
        const d = 8 + Math.floor(rand() * 4);
        const h = 5 + Math.floor(rand() * 9);
        // recuo mínimo da pista: nenhuma quadra encosta no asfalto
        if (Math.abs(gx) - w / 2 < 21) continue;
        if (gz < -30 && gz > -70 && Math.abs(gx) - w / 2 < 26) continue;
        fill(gx, gz, w, h, d, Math.floor(rand() * 6));
        occupied.push([gx, gz]);
      }
    }
    // praça com lago e árvores
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(15, 28), new THREE.MeshStandardMaterial({ color: 0x7fae57, roughness: 0.95 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(parkCenter[0], 0.06, parkCenter[1]);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(5.2, 24), new THREE.MeshStandardMaterial({ color: 0x5f97ad, roughness: 0.25, metalness: 0.3 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(parkCenter[0] + 3, 0.08, parkCenter[1] - 2);
    scene.add(lawn, pond);
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2;
      const tx = parkCenter[0] + Math.cos(angle) * (8 + rand() * 4);
      const tz = parkCenter[1] + Math.sin(angle) * (8 + rand() * 4);
      trunkBucket.push(place(new THREE.CylinderGeometry(0.26, 0.32, 2.6, 7), tx, 1.3, tz));
      crownBucket.push(place(new THREE.IcosahedronGeometry(2 + rand() * 0.8, 1), tx, 3.6 + rand() * 0.5, tz));
    }
    // estacionamento com carros parados
    const lotPad = new THREE.Mesh(new THREE.PlaneGeometry(26, 22), new THREE.MeshStandardMaterial({ color: 0x54595a, roughness: 0.95 }));
    lotPad.rotation.x = -Math.PI / 2;
    lotPad.position.set(lotCenter[0], 0.05, lotCenter[1]);
    scene.add(lotPad);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe7ebdf });
    for (let i = 0; i < 6; i += 1) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 5), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(lotCenter[0] - 10 + i * 4, 0.07, lotCenter[1] + 4);
      scene.add(line);
    }
    const parkedColors = [0xe8ede4, 0x2f3a34, 0x4a6f8a, 0xb03a2e, 0xc9d2d6, 0x63b32e];
    parkedColors.forEach((color, i) => {
      const body = new THREE.Mesh(round(1.9, 0.7, 4.2, 0.3, 3), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 }));
      body.position.set(lotCenter[0] - 10 + i * 4, 0.68, lotCenter[1] + 4);
      const cabin = new THREE.Mesh(round(1.66, 0.6, 2.1, 0.28, 3), shopGlassMat);
      cabin.position.set(lotCenter[0] - 10 + i * 4, 1.2, lotCenter[1] + 3.9);
      scene.add(body, cabin);
    });
    // meshes agrupados: 4 fachadas + platibandas + caixas d'água + árvores
    const facadeTints = [0xf2f2ec, 0xe7e5d9, 0xefe0c8, 0xd6e0e8, 0xdde4e0, 0xece8dc];
    buildingBuckets.forEach((bucket, index) => {
      if (!bucket.length) return;
      const merged = mergeGeometries(bucket, false);
      bucket.forEach((geo) => geo.dispose());
      if (!merged) return;
      const poolTex = facadePool[index % facadePool.length];
      const style = (poolTex.userData.style as string) || "classic";
      const glass = style === "glass";
      const poolNormal = ensureNormal(poolTex);
      const mesh = new THREE.Mesh(
        merged,
        new THREE.MeshStandardMaterial({
          map: poolTex,
          ...(poolNormal ? { normalMap: poolNormal, normalScale: new THREE.Vector2(glass ? 0.3 : 0.45, glass ? 0.3 : 0.45) } : {}),
          color: facadeTints[index],
          roughness: glass ? 0.18 : style === "classic" ? 0.85 : 0.4,
          metalness: glass ? 0.45 : style === "classic" ? 0.05 : 0.2,
        }),
      );
      scene.add(mesh);
    });
    const addMerged = (bucket: THREE.BufferGeometry[], material: THREE.Material) => {
      if (!bucket.length) return;
      const merged = mergeGeometries(bucket, false);
      bucket.forEach((geo) => geo.dispose());
      if (merged) scene.add(new THREE.Mesh(merged, material));
    };
    addMerged(parapetBucket, shopTrimMat);
    if (contactBucket.length) {
      const merged = mergeGeometries(contactBucket, false);
      contactBucket.forEach((geo) => geo.dispose());
      if (merged) {
        const contactMesh = new THREE.Mesh(
          merged,
          new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0.95 }),
        );
        contactMesh.renderOrder = 4;
        scene.add(contactMesh);
      }
    }
    addMerged(
      roofDeckBucket,
      new THREE.MeshStandardMaterial({ color: 0x8b928e, roughness: 0.97, metalness: 0.02 }),
    );
    addMerged(
      plinthBucket,
      new THREE.MeshStandardMaterial({ color: 0x868d87, roughness: 0.93, metalness: 0.03 }),
    );
    addMerged(roofBucket, shopAcMat);
    addMerged(trunkBucket, trunkMat);
    addMerged(crownBucket, leafMat);
    // horizonte: quadras distantes em poucos draw calls, com variação de tom
    const ringTints = [0xffffff, 0xdfe4dc, 0xcdd5cc];
    const ringMeshes: THREE.InstancedMesh[] = [];
    const ringDummy = new THREE.Object3D();
    ringTints.forEach((tint, variant) => {
      const texture = facadePool[variant % facadePool.length].clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2.5, 2.5);
      texture.needsUpdate = true;
      const ringGlass = (texture.userData.style as string) === "glass";
      const facadeMat = new THREE.MeshStandardMaterial({
        map: texture,
        color: tint,
        roughness: ringGlass ? 0.25 : 0.6,
        metalness: ringGlass ? 0.35 : 0.12,
      });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xb9bfb5, roughness: 0.95 });
      const mesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        [facadeMat, facadeMat, roofMat, roofMat, facadeMat, facadeMat],
        110,
      );
      let placed = 0;
      let guard = 0;
      while (placed < 110 && guard < 6000) {
        guard += 1;
        const x = (rand() * 2 - 1) * 330;
        const z = -180 + rand() * 360;
        const ax = Math.abs(x);
        if (ax < 122) continue;
        if (ax > 172 && ax < 208) continue; // mantém a via expressa livre
        if (rand() < 0.3) continue; // deixa clareiras
        const w = 9 + rand() * 12;
        const d = 9 + rand() * 12;
        const h = 4 + rand() * 14;
        ringDummy.position.set(x, h / 2, z);
        ringDummy.scale.set(w, h, d);
        ringDummy.rotation.y = rand() < 0.5 ? 0 : Math.PI / 2;
        ringDummy.updateMatrix();
        mesh.setMatrixAt(placed, ringDummy.matrix);
        placed += 1;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      ringMeshes.push(mesh);
      scene.add(mesh);
    });
  }

  // faixas de pedestre e semaforos nos cruzamentos da avenida
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf4f6ef, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const signalPoleMat = new THREE.MeshStandardMaterial({ color: 0x5c635f, roughness: 0.5, metalness: 0.6 });
  const signalBoxMat = new THREE.MeshStandardMaterial({ color: 0x2a302c, roughness: 0.6 });
  const signalLamps: { red: THREE.MeshBasicMaterial; green: THREE.MeshBasicMaterial }[] = [];
  [42, -42, -96, 30, 84, 138, -150, 192].forEach((crossZ) => {
    for (let i = 0; i < 7; i += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 4.6), stripeMat);
      stripe.position.set(-5.1 + i * 1.7, 0.2, crossZ);
      scene.add(stripe);
    }
    [-1, 1].forEach((side) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.2, 10), signalPoleMat);
      pole.position.set(side * 7.9, 2.1, crossZ + 3.4);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), signalPoleMat);
      arm.position.set(side * (7.9 - 1.1), 4.1, crossZ + 3.4);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.34), signalBoxMat);
      box.position.set(side * 6.9, 3.6, crossZ + 3.4);
      const redMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
      const greenMat = new THREE.MeshBasicMaterial({ color: 0x2a3a2c });
      signalLamps.push({ red: redMat, green: greenMat });
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), redMat);
      red.position.set(side * 6.9, 3.95, crossZ + 3.22);
      const green = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), greenMat);
      green.position.set(side * 6.9, 3.28, crossZ + 3.22);
      scene.add(pole, arm, box, red, green);
    });
  });

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


  // ---------------------------------------------------------------- sul: trevo, via expressa, trecho rural, periferia e cliente
  // Elementos revelados pela rolagem: opacidade para o asfalto, altura para as construções.
  const revealFades: { mat: THREE.Material & { opacity: number }; from: number; to: number; base: number }[] = [];
  const fadeIn = <T extends THREE.Material & { opacity: number }>(mat: T, from: number, to: number, base = 1) => {
    mat.transparent = true;
    revealFades.push({ mat, from, to, base });
    return mat;
  };
  const riseGroups: { group: THREE.Object3D; from: number; to: number; axis: "y" | "x" }[] = [];
  const riseIn = (group: THREE.Object3D, from: number, to: number, axis: "y" | "x" = "y") => {
    riseGroups.push({ group, from, to, axis });
    return group;
  };

  const southGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1418,
    roughness: 0.06,
    metalness: 0.96,
    emissive: 0x1d3a47,
    emissiveIntensity: 0.75,
  });
  const southTireMat = new THREE.MeshStandardMaterial({ color: 0x0d0f0d, roughness: 0.95 });
  const south = new THREE.Group();
  scene.add(south);

  const highMat = fadeIn(
    new THREE.MeshStandardMaterial({ color: 0x474e4d, roughness: 0.95, metalness: 0.08, transparent: true, opacity: 0 }),
    0.28,
    0.4,
  );
  const highLineMat = fadeIn(new THREE.MeshBasicMaterial({ color: 0xf3f8ec, transparent: true, opacity: 0 }), 0.3, 0.42, 0.9);
  const shoulderMat = fadeIn(
    new THREE.MeshStandardMaterial({ color: 0xc2c6ba, roughness: 1, transparent: true, opacity: 0 }),
    0.28,
    0.4,
  );
  const medianMat = fadeIn(
    new THREE.MeshStandardMaterial({ color: 0x9fbd7d, roughness: 1, transparent: true, opacity: 0 }),
    0.3,
    0.42,
  );
  const walkSMat = fadeIn(
    new THREE.MeshStandardMaterial({ color: 0xe9ebe3, roughness: 0.95, transparent: true, opacity: 0 }),
    0.44,
    0.58,
  );
  const fieldMats = [0x93bb6b, 0xd6c188, 0x82b05f, 0xc3d086, 0x6fa255].map((c) =>
    fadeIn(new THREE.MeshStandardMaterial({ color: c, roughness: 1, transparent: true, opacity: 0 }), 0.34, 0.5),
  );
  const dirtMat = fadeIn(
    new THREE.MeshStandardMaterial({ color: 0xc3ab84, roughness: 1, transparent: true, opacity: 0 }),
    0.36,
    0.5,
  );
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xb59d78, roughness: 0.95 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0xc7ccc7, roughness: 0.4, metalness: 0.75 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd7dbd6, roughness: 0.35, metalness: 0.8 });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x2b3330, transparent: true, opacity: 0.55 });
  const signGreenMat = new THREE.MeshStandardMaterial({ color: 0x1f6b3f, roughness: 0.6, metalness: 0.2 });
  const signWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f8f1, roughness: 0.6 });
  const asphaltYardMat = fadeIn(
    new THREE.MeshStandardMaterial({ color: 0x3a423b, roughness: 0.95, transparent: true, opacity: 0 }),
    0.6,
    0.72,
  );

  const makeRoadRibbon = (pts: [number, number][], width: number, mat: THREE.Material, y = 0.06) => {
    const curve = new THREE.CatmullRomCurve3(
      pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "centripetal",
    );
    const steps = Math.max(20, pts.length * 10);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const point = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const nx = -tan.z;
      const nz = tan.x;
      const half = width / 2;
      positions.push(point.x + nx * half, y, point.z + nz * half);
      positions.push(point.x - nx * half, y, point.z - nz * half);
      if (i < steps) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };

  const flatRoad = (w: number, d: number, x: number, z: number, mat: THREE.Material, y = 0.05) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    return mesh;
  };

  const makeTextPanel = (
    title: string,
    subtitle: string,
    w: number,
    h: number,
    bg = "#0f1a12",
    accent = "#8fe04a",
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.round((1024 * h) / w);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 26);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(6, 6, 14, canvas.height - 12);
    ctx.fillStyle = "#f5f9ef";
    ctx.textBaseline = "middle";
    let titleSize = canvas.height * 0.42;
    ctx.font = `700 ${Math.round(titleSize)}px Sora, Inter, sans-serif`;
    while (ctx.measureText(title).width > canvas.width - 90 && titleSize > 18) {
      titleSize -= 2;
      ctx.font = `700 ${Math.round(titleSize)}px Sora, Inter, sans-serif`;
    }
    ctx.fillText(title, 54, canvas.height * 0.4);
    if (subtitle) {
      ctx.fillStyle = "rgba(245,249,239,0.68)";
      ctx.font = `600 ${Math.round(canvas.height * 0.17)}px Inter, sans-serif`;
      ctx.fillText(subtitle, 54, canvas.height * 0.74);
    }
    const texture = track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  };

  // --- via expressa (duas pistas, canteiro central e guard-rail) ---
  const highway = new THREE.Group();
  riseIn(highway, 0.3, 0.42);
  south.add(highway);
  const HW_WEST = -520;
  const HW_EAST = 520;
  const hwLen = HW_EAST - 34;
  const HW_FULL = HW_EAST - HW_WEST;
  highway.add(flatRoad(HW_FULL, 7.4, 0, -203.2, highMat));
  highway.add(flatRoad(HW_FULL, 7.4, 0, -191.6, highMat));
  // acostamento de terra
  highway.add(flatRoad(HW_FULL, 2.2, 0, -207.4, shoulderMat));
  highway.add(flatRoad(HW_FULL, 2.2, 0, -187.4, shoulderMat));
  // canteiro central com abertura no trevo
  const medianGeo = new THREE.BoxGeometry(HW_EAST - 32, 0.34, 2.4);
  [32 + (HW_EAST - 32) / 2, HW_WEST + (-32 - HW_WEST) / 2].forEach((cx) => {
    const median = new THREE.Mesh(medianGeo, medianMat);
    median.position.set(cx, 0.17, -197.4);
    highway.add(median);
    const medianRail = new THREE.Mesh(new THREE.BoxGeometry(HW_EAST - 32, 0.12, 0.1), railMat);
    medianRail.position.set(cx, 0.95, -197.4);
    highway.add(medianRail);
  });
  // faixas tracejadas das duas pistas
  const hwDashCount = 118;
  const hwDashes = new THREE.InstancedMesh(round(3.6, 0.05, 0.18, 0.04, 1), highLineMat, hwDashCount);
  const hwDummy = new THREE.Object3D();
  for (let i = 0; i < hwDashCount; i += 1) {
    const east = i % 2 === 0;
    const x = -497 + Math.floor(i / 2) * 17;
    hwDummy.position.set(x, 0.08, east ? -203.2 : -191.6);
    hwDummy.updateMatrix();
    hwDashes.setMatrixAt(i, hwDummy.matrix);
  }
  highway.add(hwDashes);
  // linhas de bordo
  [-206.7, -199.7, -195.1, -188.1].forEach((z) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(HW_FULL, 0.03, 0.12), highLineMat);
    line.position.set(0, 0.08, z);
    highway.add(line);
  });
  // guard-rails
  const guardPosts: number[] = [];
  for (let x = -516; x < 520; x += 4) {
    if (x > -12 && x < 12) continue;
    if (x > 234 && x < 292) continue;
    guardPosts.push(x);
  }
  const postGeo = new THREE.BoxGeometry(0.12, 0.8, 0.12);
  const guardRail = new THREE.InstancedMesh(postGeo, guardMat, guardPosts.length * 2);
  guardPosts.forEach((x, i) => {
    hwDummy.position.set(x, 0.4, -207.6);
    hwDummy.updateMatrix();
    guardRail.setMatrixAt(i * 2, hwDummy.matrix);
    hwDummy.position.set(x, 0.4, -187.2);
    hwDummy.updateMatrix();
    guardRail.setMatrixAt(i * 2 + 1, hwDummy.matrix);
  });
  highway.add(guardRail);
  [
    [-516, -12, -207.6],
    [12, 234, -207.6],
    [292, 520, -207.6],
    [-516, -12, -187.2],
    [12, 520, -187.2],
  ].forEach(([x0, x1, z]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.16, 0.2), railMat);
    rail.position.set((x0 + x1) / 2, 0.78, z);
    highway.add(rail);
  });
  // postes de iluminação no canteiro
  for (let x = -480; x < 500; x += 48) {
    if (x > -40 && x < 40) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 9, 8), poleMat);
    pole.position.set(x, 4.5, -197.4);
    highway.add(pole);
    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), poleMat);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(x, 8.9, -197.4 + side * 1.2);
      highway.add(arm);
      const head = new THREE.Mesh(round(0.5, 0.16, 1.1, 0.05, 1), lampMat);
      head.position.set(x, 8.8, -197.4 + side * 2.3);
      highway.add(head);
    });
  }
  // pórticos com placas
  const gantrySign = (x: number, title: string, subtitle: string) => {
    const gantry = new THREE.Group();
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 8.6, 10), poleMat);
      post.position.set(0, 4.3, side * 9.6);
      gantry.add(post);
    });
    const beam = new THREE.Mesh(round(0.5, 0.5, 19.6, 0.1, 2), poleMat);
    beam.position.set(0, 8.4, 0);
    gantry.add(beam);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 2.6),
      makeTextPanel(title, subtitle, 7.6, 2.6, "#1f6b3f", "#ffffff"),
    );
    panel.position.set(0, 6.6, -1.4);
    panel.rotation.y = -Math.PI / 2;
    gantry.add(panel);
    gantry.position.set(x, 0, -197.4);
    highway.add(gantry);
  };
  gantrySign(96, "VIA EXPRESSA", "Acesso ao cliente · 6 km");
  gantrySign(268, "CLIENTE HORIZONTE", "Saída 12 · última milha");
  // marcos quilométricos
  for (let x = 70; x < 500; x += 60) {
    const marker = new THREE.Mesh(round(0.3, 1.1, 0.16, 0.04, 1), signWhiteMat);
    marker.position.set(x, 0.55, -206.6);
    highway.add(marker);
    const cap = new THREE.Mesh(round(0.34, 0.24, 0.18, 0.04, 1), new THREE.MeshBasicMaterial({ color: BRAND }));
    cap.position.set(x, 1.06, -206.6);
    highway.add(cap);
  }
  // passarela rural sobre a via expressa
  const overpass = new THREE.Group();
  const deck = new THREE.Mesh(round(13, 1.1, 46, 0.25, 2), concreteMat);
  deck.position.set(-150, 8.6, -197.4);
  overpass.add(deck);
  const deckRoad = flatRoad(11, 44, 0, 0, roadMat, 9.2);
  deckRoad.position.set(-150, 9.2, -197.4);
  overpass.add(deckRoad);
  [-1, 1].forEach((side) => {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 44), signWhiteMat);
    parapet.position.set(-150 + side * 6.3, 9.6, -197.4);
    overpass.add(parapet);
  });
  [-1, 1].forEach((side) => {
    const pier = new THREE.Mesh(round(2.6, 8.2, 2.6, 0.2, 2), concreteMat);
    pier.position.set(-150, 4.1, -197.4 + side * 13);
    overpass.add(pier);
  });
  south.add(riseIn(overpass, 0.36, 0.48));

  // --- trevo da avenida com a via expressa ---
  const junction = new THREE.Group();
  riseIn(junction, 0.28, 0.4);
  south.add(junction);
  junction.add(flatRoad(16, 6, 0, -188.5, highMat, 0.045));
  // faixa de pedestre e sinal do trevo
  for (let i = 0; i < 7; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 4.6), stripeMat);
    stripe.position.set(-5.1 + i * 1.7, 0.2, -184);
    junction.add(stripe);
  }
  const stopLine = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.03, 0.5), highLineMat);
  stopLine.position.set(-4.4, 0.12, -181.4);
  junction.add(stopLine);
  // seta de conversão à esquerda
  const arrowCanvas = document.createElement("canvas");
  arrowCanvas.width = 256;
  arrowCanvas.height = 512;
  const arrowCtx = arrowCanvas.getContext("2d")!;
  arrowCtx.strokeStyle = "#f3f8ec";
  arrowCtx.lineWidth = 30;
  arrowCtx.lineCap = "round";
  arrowCtx.beginPath();
  arrowCtx.moveTo(128, 470);
  arrowCtx.lineTo(128, 200);
  arrowCtx.quadraticCurveTo(128, 120, 70, 120);
  arrowCtx.stroke();
  arrowCtx.beginPath();
  arrowCtx.moveTo(70, 60);
  arrowCtx.lineTo(70, 180);
  arrowCtx.lineTo(10, 120);
  arrowCtx.closePath();
  arrowCtx.fillStyle = "#f3f8ec";
  arrowCtx.fill();
  const turnArrowTex = track(new THREE.CanvasTexture(arrowCanvas));
  const turnArrowMat = new THREE.MeshBasicMaterial({ map: turnArrowTex, transparent: true });
  const turnArrow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), turnArrowMat);
  turnArrow.rotation.x = -Math.PI / 2;
  turnArrow.position.set(-4.4, 0.13, -177.6);
  junction.add(turnArrow);
  const junctionSignal = new THREE.Group();
  junctionSignal.position.set(6.2, 0, -181);
  const jsPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.6, 10), signalPoleMat);
  jsPole.position.y = 2.3;
  junctionSignal.add(jsPole);
  const jsArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.4), signalPoleMat);
  jsArm.position.set(0, 4.4, -2.2);
  junctionSignal.add(jsArm);
  const jsBox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.15, 0.36), signalBoxMat);
  jsBox.position.set(0, 3.9, -4.3);
  junctionSignal.add(jsBox);
  const jsRedMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
  const jsGreenMat = new THREE.MeshBasicMaterial({ color: 0x2a3a2c });
  const jsRed = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), jsRedMat);
  jsRed.position.set(0, 4.27, -4.48);
  const jsGreen = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), jsGreenMat);
  jsGreen.position.set(0, 3.6, -4.48);
  junctionSignal.add(jsRed, jsGreen);
  signalLamps.push({ red: jsRedMat, green: jsGreenMat });
  const jsSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.9),
    makeTextPanel("SAÍDA · CLIENTE", "Via expressa leste", 3.4, 0.9, "#1f6b3f", "#ffffff"),
  );
  jsSign.position.set(0, 5.4, -4.2);
  junctionSignal.add(jsSign);
  junction.add(junctionSignal);

  // --- trecho rural: campos, cerca, fazenda, silos e rede elétrica ---
  const rural = new THREE.Group();
  riseIn(rural, 0.34, 0.5);
  south.add(rural);
  const fieldLayout: [number, number, number, number, number][] = [
    [64, -248, 54, 62, 0],
    [122, -248, 54, 62, 1],
    [180, -248, 54, 62, 2],
    [238, -248, 50, 62, 3],
    [64, -312, 54, 60, 3],
    [122, -312, 54, 60, 4],
    [180, -312, 54, 60, 0],
    [238, -312, 50, 60, 1],
    [64, -372, 54, 56, 1],
    [122, -372, 54, 56, 3],
    [180, -372, 54, 56, 2],
    [238, -372, 50, 56, 4],
    [10, -276, 44, 120, 2],
    [292, -276, 44, 120, 0],
  ];
  fieldLayout.forEach(([x, z, w, d, tone]) => {
    rural.add(flatRoad(w - 2, d - 2, x, z, fieldMats[tone], 0.03));
    // sulcos de plantio
    const rows = 7;
    for (let r = 0; r < rows; r += 1) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(w - 8, 0.06, 0.5), fieldMats[(tone + 2) % fieldMats.length]);
      row.position.set(x, 0.07, z - d / 2 + 6 + r * ((d - 12) / (rows - 1)));
      rural.add(row);
    }
  });
  // base de grama do trecho rural
  const ruralGrass = new THREE.MeshStandardMaterial({ color: 0x9dbb7c, roughness: 1, transparent: true, opacity: 0 });
  revealFades.push({ mat: ruralGrass, from: 0.32, to: 0.46, base: 1 });
  rural.add(flatRoad(360, 220, 160, -300, ruralGrass, 0.02));
  // renques de árvores entre os campos
  [[36, -232], [72, -280], [110, -234], [158, -236], [196, -280], [232, -238], [250, -300], [30, -300]].forEach(([x, z]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 3, 6), trunkMat);
    trunk.position.set(x, 1.5, z);
    rural.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), leafMat);
    crown.position.set(x, 4.4, z);
    crown.scale.set(1, 1.15, 1);
    rural.add(crown);
  });
  // cerca ao longo da via expressa
  const fencePosts: number[] = [];
  for (let x = 30; x < 260; x += 3.2) fencePosts.push(x);
  const fencePostMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.15, 0.14), fenceMat, fencePosts.length);
  fencePosts.forEach((x, i) => {
    hwDummy.position.set(x, 0.57, -213);
    hwDummy.updateMatrix();
    fencePostMesh.setMatrixAt(i, hwDummy.matrix);
  });
  rural.add(fencePostMesh);
  [0.5, 1.0].forEach((y) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(230, 0.09, 0.08), fenceMat);
    rail.position.set(145, y, -213);
    rural.add(rail);
  });
  // estrada de terra da passarela até a fazenda
  rural.add(makeRoadRibbon([[150, -213], [150, -236], [148, -258], [150, -276]], 5.2, dirtMat, 0.055));
  // fazenda
  const farm = new THREE.Group();
  farm.position.set(150, 0, -292);
  farm.scale.setScalar(1.6);
  rural.add(farm);
  const farmWallMat = new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: 0.9 });
  const farmRoofMat = new THREE.MeshStandardMaterial({ color: 0xa8593c, roughness: 0.85 });
  const farmHouse = new THREE.Mesh(round(13, 4.6, 10, 0.2, 2), farmWallMat);
  farmHouse.position.set(-14, 2.3, 0);
  farm.add(farmHouse);
  const houseRoof = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 13.6, 4, 1, false, 0, Math.PI), farmRoofMat);
  houseRoof.rotation.z = Math.PI / 2;
  houseRoof.rotation.y = Math.PI / 4;
  houseRoof.scale.set(1, 1, 0.62);
  houseRoof.position.set(-14, 4.6, 0);
  farm.add(houseRoof);
  const barn = new THREE.Mesh(round(16, 6.4, 11, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0xb8472f, roughness: 0.85 }));
  barn.position.set(8, 3.2, -4);
  farm.add(barn);
  const barnRoof = new THREE.Mesh(round(16.8, 0.4, 11.8, 0.12, 2), roofMat);
  barnRoof.position.set(8, 6.6, -4);
  farm.add(barnRoof);
  const barnDoor = new THREE.Mesh(round(4.6, 4, 0.2, 0.08, 2), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 }));
  barnDoor.position.set(8, 2.1, 1.6);
  farm.add(barnDoor);
  [20, 25].forEach((sx) => {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 13, 20), new THREE.MeshStandardMaterial({ color: 0xd7dcd2, roughness: 0.55, metalness: 0.45 }));
    silo.position.set(sx, 6.5, -12);
    farm.add(silo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc3cac0, roughness: 0.5, metalness: 0.5 }));
    dome.position.set(sx, 13, -12);
    farm.add(dome);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.04, 3.04, 0.2, 20), new THREE.MeshBasicMaterial({ color: BRAND_DEEP }));
    band.position.set(sx, 9.4, -12);
    farm.add(band);
  });
  // segundo galpão, moinho, caixa d'água e curral
  const barn2 = new THREE.Mesh(round(11, 5.2, 9, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 }));
  barn2.position.set(-2, 2.6, -14);
  farm.add(barn2);
  const barn2Roof = new THREE.Mesh(round(11.6, 0.4, 9.6, 0.12, 2), farmRoofMat);
  barn2Roof.position.set(-2, 5.4, -14);
  farm.add(barn2Roof);
  const millTower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, 9, 10), farmWallMat);
  millTower.position.set(-24, 4.5, -12);
  farm.add(millTower);
  const millTop = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.2, 10), farmRoofMat);
  millTop.position.set(-24, 10.1, -12);
  farm.add(millTop);
  const blades = new THREE.Group();
  for (let b = 0; b < 4; b += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.2, 0.12), new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.8 }));
    blade.position.y = 3.1;
    const holder = new THREE.Group();
    holder.add(blade);
    holder.rotation.z = (b / 4) * Math.PI * 2;
    blades.add(holder);
  }
  blades.position.set(-24, 11.6, -10.2);
  farm.add(blades);
  farm.userData.blades = blades;
  const farmTank = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.2, 12), new THREE.MeshStandardMaterial({ color: 0xd7dcd2, roughness: 0.6, metalness: 0.35 }));
  farmTank.position.set(-6, 9.4, -8);
  farm.add(farmTank);
  [-1.4, 1.4].forEach((off) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7.8, 0.22), trimMat);
    leg.position.set(-6 + off, 3.9, -8);
    farm.add(leg);
  });
  // curral de madeira
  const penMat = new THREE.MeshStandardMaterial({ color: 0xb59d78, roughness: 0.95 });
  for (let i = 0; i < 10; i += 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 0.18), penMat);
    post.position.set(-10 + i * 2.2, 0.75, 14);
    farm.add(post);
  }
  [0.6, 1.2].forEach((y) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 0.1), penMat);
    rail.position.set(-0.1, y, 14);
    farm.add(rail);
  });
  // trator
  const farmTireMat = new THREE.MeshStandardMaterial({ color: 0x22261f, roughness: 0.9 });
  const tractor = new THREE.Group();
  const tBody = new THREE.Mesh(round(3.4, 1.5, 1.9, 0.3, 2), new THREE.MeshStandardMaterial({ color: 0x2f6f4f, roughness: 0.6 }));
  tBody.position.y = 1.5;
  tractor.add(tBody);
  const tCab = new THREE.Mesh(round(1.6, 1.4, 1.7, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0x24553d, roughness: 0.6 }));
  tCab.position.set(-0.8, 2.9, 0);
  tractor.add(tCab);
  const bigWheel = new THREE.CylinderGeometry(1.15, 1.15, 0.5, 14);
  bigWheel.rotateX(Math.PI / 2);
  const smallWheel = new THREE.CylinderGeometry(0.62, 0.62, 0.4, 12);
  smallWheel.rotateX(Math.PI / 2);
  [[-1.05, 1], [-1.05, -1]].forEach(([wx, side]) => {
    const wheel = new THREE.Mesh(bigWheel, farmTireMat);
    wheel.position.set(wx, 1.15, side * 1.05);
    tractor.add(wheel);
  });
  [[1.15, 1], [1.15, -1]].forEach(([wx, side]) => {
    const wheel = new THREE.Mesh(smallWheel, farmTireMat);
    wheel.position.set(wx, 0.62, side * 1.0);
    tractor.add(wheel);
  });
  tractor.position.set(24, 0, 12);
  tractor.rotation.y = -0.6;
  farm.add(tractor);
  // fardos de feno
  const baleGeo = new THREE.CylinderGeometry(1.15, 1.15, 1.7, 16);
  baleGeo.rotateZ(Math.PI / 2);
  const baleMat = new THREE.MeshStandardMaterial({ color: 0xd8c07a, roughness: 1 });
  [[86, -300], [91, -304], [96, -300], [90, -296], [200, -290], [206, -294]].forEach(([x, z]) => {
    const bale = new THREE.Mesh(baleGeo, baleMat);
    bale.position.set(x, 1.15, z);
    bale.rotation.y = (x + z) * 0.05;
    rural.add(bale);
  });
  // vacas
  const cowMat = new THREE.MeshStandardMaterial({ color: 0xf2f1ea, roughness: 0.9 });
  const cowSpotMat = new THREE.MeshStandardMaterial({ color: 0x3a3a36, roughness: 0.9 });
  [[54, -270], [60, -276], [47, -280], [64, -266], [210, -262]].forEach(([x, z], i) => {
    const cow = new THREE.Group();
    const body = new THREE.Mesh(round(1.9, 0.95, 0.85, 0.3, 2), cowMat);
    body.position.y = 1.15;
    cow.add(body);
    const spot = new THREE.Mesh(round(0.7, 0.6, 0.88, 0.2, 2), cowSpotMat);
    spot.position.set(0.2, 1.2, 0);
    cow.add(spot);
    const head = new THREE.Mesh(round(0.55, 0.55, 0.7, 0.2, 2), cowMat);
    head.position.set(1.05, 1.35, 0);
    cow.add(head);
    [
      [-0.6, 0.35],
      [-0.6, -0.35],
      [0.65, 0.35],
      [0.65, -0.35],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), cowMat);
      leg.position.set(lx, 0.37, lz);
      cow.add(leg);
    });
    cow.position.set(x, 0, z);
    cow.rotation.y = i * 1.3;
    rural.add(cow);
  });
  // rede elétrica rural
  const poleLine: THREE.Vector3[] = [];
  for (let x = 34; x < 500; x += 38) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 8.4, 8), fenceMat);
    pole.position.set(x, 4.2, -210);
    rural.add(pole);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), fenceMat);
    cross.position.set(x, 7.9, -210);
    rural.add(cross);
    poleLine.push(new THREE.Vector3(x, 7.9, -210));
  }
  const wirePts: number[] = [];
  poleLine.forEach((a, i) => {
    const b = poleLine[i + 1];
    if (!b) return;
    [-0.9, 0, 0.9].forEach((off) => {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y -= 0.8;
      wirePts.push(a.x, a.y, a.z + off, mid.x, mid.y, mid.z + off, mid.x, mid.y, mid.z + off, b.x, b.y, b.z + off);
    });
  });
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3));
  rural.add(new THREE.LineSegments(wireGeo, wireMat));

  // --- periferia ---
  const periph = new THREE.Group();
  riseIn(periph, 0.46, 0.64);
  south.add(periph);
  // rua da periferia
  periph.add(flatRoad(9, 172, 299, -298, highMat, 0.055));
  [-6.1, 6.1].forEach((side) => {
    periph.add(flatRoad(2.4, 172, 299 + side, -298, walkSMat, 0.08));
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 172), gridCurbMat);
    curb.position.set(299 + side * 4.7, 0.13, -298);
    periph.add(curb);
  });
  const periDash = new THREE.InstancedMesh(round(0.16, 0.04, 2.6, 0.05, 1), highLineMat, 30);
  for (let i = 0; i < 30; i += 1) {
    hwDummy.position.set(299, 0.1, -222 - i * 5.4);
    hwDummy.updateMatrix();
    periDash.setMatrixAt(i, hwDummy.matrix);
  }
  periph.add(periDash);
  // acesso ao cliente (curva da rua para a portaria)
  periph.add(makeRoadRibbon([[296.6, -356], [298, -368], [305, -376], [318, -379.5], [330, -379.5]], 9, highMat, 0.06));
  // rampa de saída da via expressa para a rua da periferia
  periph.add(
    makeRoadRibbon(
      [
        [196, -203.2],
        [230, -203.2],
        [262, -203.2],
        [280, -203.6],
        [287, -206],
        [290.5, -211],
        [291.6, -218],
        [292, -226],
        [292, -246],
      ],
      12,
      highMat,
      0.06,
    ),
  );
  // sinalização da saída
  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.4),
    makeTextPanel("SAÍDA 12", "Periferia · Cliente Horizonte", 4.6, 1.4, "#1f6b3f", "#ffffff"),
  );
  exitSign.position.set(286, 3.4, -222);
  exitSign.rotation.y = -Math.PI / 2.6;
  periph.add(exitSign);
  const exitPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8), poleMat);
  exitPost.position.set(286, 1.7, -222.2);
  periph.add(exitPost);
  // sinal e faixa de pedestre na periferia
  [(-300)].forEach((cz) => {
    for (let i = 0; i < 5; i += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 3.6), stripeMat);
      stripe.position.set(295.8 + i * 1.55, 0.18, cz);
      periph.add(stripe);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4, 10), signalPoleMat);
    pole.position.set(305.6, 2, cz + 2.6);
    periph.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.95, 0.3), signalBoxMat);
    box.position.set(305.6, 3.6, cz + 2.6);
    periph.add(box);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
    red.position.set(305.6, 3.9, cz + 2.44);
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x2a3a2c }));
    green.position.set(305.6, 3.32, cz + 2.44);
    periph.add(red, green);
  });
  // casas e comércio da periferia
  const periWallMats = [0xf2e8d8, 0xe9dcc8, 0xf4f1e6, 0xdfe4da, 0xf0d9c4, 0xe3e8ea].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 }),
  );
  const periRoofMats = [0xb85a3a, 0x9c4a30, 0x6b6f68, 0xc27a4a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const shopSigns = ["MERCADO", "PADARIA", "OFICINA", "LANCHONETE", "FARMÁCIA", "AUTO PEÇAS", "MATERIAIS", "SALÃO"];
  const periSignBgs = ["#3f7d34", "#c0563c", "#2f5f8a", "#b8862f", "#4a4f58", "#7a3f6d"];
  const periAwningMats = [0x7d9a63, 0x9a6b4a, 0xb08a4a, 0x5f7f6a, 0x8f6a5a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }),
  );
  const addPeriphBuilding = (x: number, z: number, w: number, d: number, h: number, face: number, i: number, rotY = 0) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(round(w, h, d, 0.2, 2), periWallMats[i % periWallMats.length]);
    body.position.y = h / 2;
    g.add(body);
    const roof = new THREE.Mesh(round(w + 0.5, 0.35, d + 0.5, 0.12, 2), periRoofMats[i % periRoofMats.length]);
    roof.position.y = h + 0.1;
    g.add(roof);
    const parapetMat = periWallMats[i % periWallMats.length];
    [
      [0, (d + 0.5) / 2, w + 0.7, 0.22],
      [0, -(d + 0.5) / 2, w + 0.7, 0.22],
      [(w + 0.5) / 2, 0, 0.22, d + 0.7],
      [-(w + 0.5) / 2, 0, 0.22, d + 0.7],
    ].forEach(([px, pz, pw, pd]) => {
      const parapet = new THREE.Mesh(round(pw, 0.55, pd, 0.04, 1), parapetMat);
      parapet.position.set(px, h + 0.42, pz);
      g.add(parapet);
    });
    if (i % 3 === 0) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 1.3, 14),
        new THREE.MeshStandardMaterial({ color: 0x93a7ab, roughness: 0.55, metalness: 0.2 }),
      );
      tank.position.set(w * 0.24, h + 1.1, -d * 0.2);
      g.add(tank);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), poleMat);
      antenna.position.set(-w * 0.3, h + 1.7, d * 0.1);
      g.add(antenna);
    }
    // vitrine e porta
    const glass = new THREE.Mesh(round(w * 0.7, h * 0.34, 0.14, 0.05, 1), shopGlassMat);
    glass.position.set(0, h * 0.26, (d / 2 + 0.06) * face);
    g.add(glass);
    // janelas superiores
    const winMat = new THREE.MeshStandardMaterial({ color: 0x2e3d38, roughness: 0.3, metalness: 0.5 });
    for (let r = 1; r < Math.max(2, Math.floor(h / 3)); r += 1) {
      for (let c = 0; c < 2; c += 1) {
        const win = new THREE.Mesh(round(w * 0.24, 1.05, 0.12, 0.04, 1), winMat);
        win.position.set(-w * 0.24 + c * w * 0.48, r * 2.6 + 0.6, (d / 2 + 0.06) * face);
        g.add(win);
      }
    }
    // toldo e placa
    const awning = new THREE.Mesh(round(w * 0.86, 0.12, 1.5, 0.05, 1), periAwningMats[i % periAwningMats.length]);
    awning.position.set(0, h * 0.5, (d / 2 + 0.62) * face);
    awning.rotation.x = face > 0 ? -0.16 : 0.16;
    g.add(awning);
    const signW = w * 0.72;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(signW, signW * 0.25),
      new THREE.MeshBasicMaterial({
        map: track(makeShopSignTexture(shopSigns[i % shopSigns.length], periSignBgs[i % periSignBgs.length], "#ffffff")),
      }),
    );
    sign.position.set(0, h * 0.68, (d / 2 + 0.1) * face);
    sign.rotation.y = face > 0 ? 0 : Math.PI;
    g.add(sign);
    // caixa de ar-condicionado
    if (i % 3 === 0) {
      const ac = new THREE.Mesh(round(0.9, 0.55, 0.5, 0.08, 1), unitMat);
      ac.position.set(w * 0.28, h * 0.62, (d / 2 + 0.3) * face);
      g.add(ac);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    periph.add(g);
  };
  for (let i = 0; i < 9; i += 1) {
    const z = -242 - i * 13.4;
    addPeriphBuilding(286.4, z, 11.5, 9.5, 5.5 + (i % 3) * 2.2, 1, i, Math.PI / 2);
    addPeriphBuilding(311.6, z - 6.5, 11.5, 9.5, 6 + ((i + 1) % 3) * 2.4, 1, i + 3, -Math.PI / 2);
  }
  // postes e fios da rua
  const periPoles: THREE.Vector3[] = [];
  for (let z = -224; z > -366; z -= 22) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 8), poleMat);
    pole.position.set(306.4, 4, z);
    periph.add(pole);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), poleMat);
    cross.position.set(306.4, 7.5, z);
    periph.add(cross);
    periPoles.push(new THREE.Vector3(306.4, 7.5, z));
  }
  const periWire: number[] = [];
  periPoles.forEach((a, i) => {
    const b = periPoles[i + 1];
    if (!b) return;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= 0.55;
    [-0.7, 0.7].forEach((off) => {
      periWire.push(a.x + off, a.y, a.z, mid.x + off, mid.y, mid.z, mid.x + off, mid.y, mid.z, b.x + off, b.y, b.z);
    });
  });
  const periWireGeo = new THREE.BufferGeometry();
  periWireGeo.setAttribute("position", new THREE.Float32BufferAttribute(periWire, 3));
  periph.add(new THREE.LineSegments(periWireGeo, wireMat));
  // caixa d'água
  const waterTower = new THREE.Group();
  const wtLegs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 12, 8), poleMat);
  wtLegs.position.y = 6;
  waterTower.add(wtLegs);
  const wtTank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4, 20), new THREE.MeshStandardMaterial({ color: 0xcfd8d4, roughness: 0.5, metalness: 0.4 }));
  wtTank.position.y = 13.4;
  waterTower.add(wtTank);
  const wtTop = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8c2be, roughness: 0.5, metalness: 0.4 }));
  wtTop.position.y = 15.4;
  waterTower.add(wtTop);
  waterTower.position.set(322, 0, -258);
  periph.add(waterTower);
  // ponto de ônibus
  const busStop = new THREE.Group();
  const busRoof = new THREE.Mesh(round(4.4, 0.16, 1.6, 0.06, 1), new THREE.MeshStandardMaterial({ color: 0x39443a, roughness: 0.6, metalness: 0.4 }));
  busRoof.position.y = 2.6;
  busStop.add(busRoof);
  [-1.9, 1.9].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), poleMat);
    post.position.set(x, 1.3, -0.6);
    avenueBusStop.add(post);
  });
  const bench = new THREE.Mesh(round(3.4, 0.14, 0.6, 0.05, 1), new THREE.MeshStandardMaterial({ color: 0x8d6a45, roughness: 0.8 }));
  bench.position.set(0, 0.5, 0.2);
  busStop.add(bench);
  busStop.position.set(292.2, 0, -306);
  busStop.rotation.y = Math.PI / 2;
  periph.add(busStop);
  // árvores da periferia
  [[288, -234], [310, -232], [288, -330], [311, -352], [290, -358]].forEach(([x, z]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6), trunkMat);
    trunk.position.set(x, 1.1, z);
    periph.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), leafMat);
    crown.position.set(x, 3.2, z);
    crown.scale.set(1, 0.9, 1);
    periph.add(crown);
  });

  // --- cliente distante ---
  const clientSite = new THREE.Group();
  riseIn(clientSite, 0.6, 0.78);
  south.add(clientSite);
  const clientYard = flatRoad(150, 58, 392, -380, asphaltYardMat, 0.07);
  south.add(clientYard);
  const clientWarehouse = new THREE.Group();
  clientSite.add(clientWarehouse);
  const cwBody = new THREE.Mesh(round(80, 13, 24, 0.6, 3), wallMat);
  cwBody.position.set(392, 6.5, -340);
  clientWarehouse.add(cwBody);
  const cwRoof = new THREE.Mesh(round(81.6, 0.6, 25.6, 0.3, 2), roofMat);
  cwRoof.position.set(392, 13.2, -340);
  clientWarehouse.add(cwRoof);
  const cwPlinth = new THREE.Mesh(round(80.6, 0.8, 24.6, 0.2, 2), trimMat);
  cwPlinth.position.set(392, 0.4, -340);
  clientWarehouse.add(cwPlinth);
  const cwGlass = new THREE.Mesh(
    round(76, 4.6, 0.4, 0.1, 2),
    new THREE.MeshStandardMaterial({ color: 0x4a5c50, roughness: 0.28, metalness: 0.45 }),
  );
  cwGlass.position.set(392, 10.2, -351.9);
  clientWarehouse.add(cwGlass);
  const cwMullionMat = new THREE.MeshStandardMaterial({ color: 0xf2f5ee, roughness: 0.5, metalness: 0.2 });
  for (let i = 0; i <= 10; i += 1) {
    const mullion = new THREE.Mesh(round(0.26, 4.7, 0.5, 0.04, 1), cwMullionMat);
    mullion.position.set(354 + i * 7.6, 10.2, -352);
    clientWarehouse.add(mullion);
  }
  const cwSign = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 5.6),
    makeTextPanel("CLIENTE HORIZONTE", "CENTRO DE DISTRIBUIÇÃO · RECEBIMENTO", 34, 5.6, "#0f1a12", "#8fe04a"),
  );
  cwSign.position.set(392, 9.6, -352.15);
  clientWarehouse.add(cwSign);
  const cwCanopy = new THREE.Mesh(round(76, 0.25, 5.4, 0.1, 2), concreteMat);
  cwCanopy.position.set(392, 6.6, -349.4);
  clientWarehouse.add(cwCanopy);
  const cwCanopyEdge = new THREE.Mesh(new THREE.BoxGeometry(76, 0.12, 0.16), stripMat);
  cwCanopyEdge.position.set(392, 6.5, -346.8);
  clientWarehouse.add(cwCanopyEdge);
  for (let i = 0; i < 9; i += 1) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.5, 8), poleMat);
    column.position.set(356 + i * 9, 3.25, -347);
    clientWarehouse.add(column);
  }
  const clientDoorMats: THREE.MeshBasicMaterial[] = [];
  const clientDoorMeshes: THREE.Mesh[] = [];
  [360, 376, 392, 408, 424].forEach((x) => {
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0 });
    clientDoorMats.push(doorMat);
    const door = new THREE.Mesh(round(6, 5.6, 0.22, 0.08, 2), doorMat);
    door.position.set(x, 3, -351.9);
    clientDoorMeshes.push(door);
    clientWarehouse.add(door);
    const lintel = new THREE.Mesh(round(6.6, 0.5, 1, 0.12, 2), trimMat);
    lintel.position.set(x, 6.1, -352);
    clientWarehouse.add(lintel);
    [-2, 2].forEach((dx) => {
      const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1, 10), trimMat);
      bumper.rotation.x = Math.PI / 2;
      bumper.position.set(x + dx, 1, -352.2);
      clientWarehouse.add(bumper);
    });
  });
  [-20, -6, 8, 22].forEach((dx) => {
    const unit = new THREE.Mesh(round(3.6, 1.1, 2.6, 0.2, 2), unitMat);
    unit.position.set(392 + dx, 14, -344);
    clientWarehouse.add(unit);
  });
  const clientLight = new THREE.PointLight(0xffd9a0, 40, 70, 2);
  clientLight.position.set(392, 6, -362);
  clientWarehouse.add(clientLight);
  // projeto executivo: niveladoras, bollards, numeração de doca e sinalização
  const dockSteelMat = new THREE.MeshStandardMaterial({ color: 0x8d9497, roughness: 0.42, metalness: 0.72 });
  const dockYellowMat = new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.5, metalness: 0.1, emissive: 0x2a1d00 });
  const dockLampMat = new THREE.MeshBasicMaterial({ color: 0x63e07a });
  const dockNumbers = ["01", "02", "03", "04", "05"];
  [360, 376, 392, 408, 424].forEach((x, index) => {
    const leveler = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.9), dockSteelMat);
    leveler.position.set(x, 1.12, -350.75);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.32, 0.28), dockSteelMat);
    lip.position.set(x, 1.02, -349.9);
    clientWarehouse.add(leveler, lip);
    [-3.3, 3.3].forEach((dx) => {
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.15, 10), dockYellowMat);
      bollard.position.set(x + dx, 0.78, -350.2);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), trimMat);
      cap.position.set(x + dx, 1.38, -350.2);
      clientWarehouse.add(bollard, cap);
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.14), dockLampMat);
    lamp.position.set(x + 3.55, 5.45, -351.7);
    clientWarehouse.add(lamp);
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.1),
      makeTextPanel(`DOCA ${dockNumbers[index]}`, "CARRETA 3 EIXOS", 2.2, 1.1, "#101a13", "#ffffff"),
    );
    number.position.set(x - 4.5, 4.4, -351.85);
    clientWarehouse.add(number);
  });
  // cobertura: sheds translúcidos, guarda-corpo e exaustores
  const skylightMat = new THREE.MeshStandardMaterial({ color: 0xdff0ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.65 });
  for (let i = 0; i < 6; i += 1) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 1.6), skylightMat);
    shed.position.set(362 + i * 12, 13.7, -340);
    clientWarehouse.add(shed);
  }
  for (let i = 0; i < 10; i += 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), trimMat);
    post.position.set(353 + i * 8.6, 13.95, -328.6);
    clientWarehouse.add(post);
  }
  const roofRail = new THREE.Mesh(new THREE.BoxGeometry(80, 0.08, 0.08), trimMat);
  roofRail.position.set(392, 14.4, -328.6);
  clientWarehouse.add(roofRail);
  [-26, -13, 13, 26].forEach((dx) => {
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12), dockSteelMat);
    vent.position.set(392 + dx, 13.9, -334);
    const ventCap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.5, 12), trimMat);
    ventCap.position.set(392 + dx, 14.85, -334);
    clientWarehouse.add(vent, ventCap);
  });
  // fachadas laterais com janelas altas e porta de pessoas
  [-392 + 160, 392 + 160].forEach(() => undefined);
  [352.2, 431.8].forEach((x) => {
    const sideGlass = new THREE.Mesh(round(0.4, 3.2, 18, 0.1, 2), cwGlass.material as THREE.Material);
    sideGlass.position.set(x, 10.4, -340);
    clientWarehouse.add(sideGlass);
    for (let i = 0; i <= 4; i += 1) {
      const mullion = new THREE.Mesh(round(0.5, 3.3, 0.26, 0.04, 1), cwMullionMat);
      mullion.position.set(x, 10.4, -349 + i * 4.5);
      clientWarehouse.add(mullion);
    }
  });
  const staffDoor = new THREE.Mesh(round(0.24, 2.4, 1.2, 0.06, 2), trimMat);
  staffDoor.position.set(352.1, 1.2, -334);
  clientWarehouse.add(staffDoor);
  const cwExitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ color: 0x2fbf5a }));
  cwExitSign.rotation.y = -Math.PI / 2;
  cwExitSign.position.set(351.95, 2.9, -334);
  clientWarehouse.add(cwExitSign);
  // calha e condutores
  [352.2, 431.8].forEach((x) => {
    const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 25), trimMat);
    gutter.position.set(x, 13.35, -340);
    clientWarehouse.add(gutter);
    [-352.2, -327.8].forEach((z) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 13, 8), trimMat);
      pipe.position.set(x + (x < 392 ? 0.3 : -0.3), 6.5, z);
      clientWarehouse.add(pipe);
    });
  });
  // pátio: setas de manobra, faixa de pedestre, "PARE" e postes de iluminação
  const yardMarkMat = new THREE.MeshBasicMaterial({ color: 0xe8f2df, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 4; i += 1) {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 3.4), yardMarkMat);
    shaft.position.set(360 + i * 21, 0.12, -372);
    south.add(shaft);
    const head = new THREE.Mesh(new THREE.CircleGeometry(1.1, 3), yardMarkMat);
    head.rotation.x = -Math.PI / 2;
    head.rotation.z = Math.PI / 2;
    head.position.set(360 + i * 21, 0.12, -374.9);
    south.add(head);
  }
  for (let i = 0; i < 7; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 3.2), yardMarkMat);
    stripe.position.set(340 + i * 1.5, 0.12, -388);
    south.add(stripe);
  }
  const stopSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.4),
    makeTextPanel("PARE", "na cancela", 3.2, 1.4, "#ffffff", "#b3261e"),
  );
  stopSign.rotation.x = -Math.PI / 2;
  stopSign.position.set(318, 0.12, -382);
  south.add(stopSign);
  [352, 412, 448].forEach((x) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 11, 10), poleMat);
    mast.position.set(x, 5.5, -370);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.4), poleMat);
    arm.position.set(x, 10.9, -371.1);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: 0xdfe4e6, roughness: 0.4, metalness: 0.6 }));
    head.position.set(x, 10.85, -372.2);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.45), new THREE.MeshBasicMaterial({ color: 0xfff2cf }));
    bulb.position.set(x, 10.68, -372.2);
    south.add(mast, arm, head, bulb);
  });
  // cerca perimetral com mourões e árvores alinhadas
  const cwFenceMat = new THREE.MeshStandardMaterial({ color: 0xb9c2bd, roughness: 0.7, metalness: 0.35, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 34; i += 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), trimMat);
    post.position.set(322 + i * 4.4, 1.1, -404);
    south.add(post);
  }
  const fencePanel = new THREE.Mesh(new THREE.BoxGeometry(146, 1.9, 0.06), cwFenceMat);
  fencePanel.position.set(392, 1.1, -404);
  south.add(fencePanel);
  for (let i = 0; i < 8; i += 1) {
    const tx = 326 + i * 19;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.4, 7), trunkMat);
    trunk.position.set(tx, 1.2, -398);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), leafMat);
    crown.position.set(tx, 3.2, -398);
    south.add(trunk, crown);
  }
  // vagas pintadas no pátio
  const clientBayMat = new THREE.MeshBasicMaterial({ color: 0xe8f2df, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 12; i += 1) {
    const bay = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 6.4), clientBayMat);
    bay.position.set(352 + i * 7.6, 0.13, -362);
    south.add(bay);
  }
  const clientBayBar = new THREE.Mesh(new THREE.BoxGeometry(86, 0.02, 0.16), clientBayMat);
  clientBayBar.position.set(392, 0.13, -358.8);
  south.add(clientBayBar);
  // portaria, cancela e totem
  const cGate = new THREE.Group();
  cGate.position.set(318, 0, -388);
  const gateHouse = new THREE.Mesh(round(5, 3, 4, 0.25, 2), wallMat);
  gateHouse.position.set(0, 1.5, 0);
  cGate.add(gateHouse);
  const cGateRoof = new THREE.Mesh(round(5.8, 0.3, 4.8, 0.1, 2), roofMat);
  cGateRoof.position.set(0, 3.1, 0);
  cGate.add(cGateRoof);
  const cGateWindow = new THREE.Mesh(round(3.2, 1.1, 0.12, 0.06, 2), new THREE.MeshStandardMaterial({ color: 0x223029, roughness: 0.2, metalness: 0.8 }));
  cGateWindow.position.set(0, 1.9, 2.06);
  cGate.add(cGateWindow);
  const cBarrierPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 8), trimMat);
  cBarrierPost.position.set(3.4, 0.65, 3.6);
  cGate.add(cBarrierPost);
  const barrierArm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  barrierArm.position.set(6.6, 1.25, 3.6);
  cGate.add(barrierArm);
  const stripeA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.15), new THREE.MeshBasicMaterial({ color: 0x63b32e }));
  stripeA.position.set(4.6, 1.25, 3.6);
  cGate.add(stripeA);
  const stripeB = stripeA.clone();
  stripeB.position.x = 8.2;
  cGate.add(stripeB);
  clientSite.add(cGate);
  const totem = new THREE.Group();
  const totemPole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), trimMat);
  totemPole.position.y = 3;
  totem.add(totemPole);
  const totemPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4.2),
    makeTextPanel("CLIENTE", "HORIZONTE · recebimento", 7, 4.2, "#0f1a12", "#8fe04a"),
  );
  totemPanel.position.set(0, 5.6, 0.3);
  totem.add(totemPanel);
  totem.position.set(306, 0, -396);
  totem.rotation.y = Math.PI * 0.25;
  clientSite.add(totem);
  // estacionamento de visitantes
  [0xffffff, 0x2f3a34, 0x63b32e].forEach((color, index) => {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.65 });
    const body = new THREE.Mesh(round(1.95, 0.72, 4.3, 0.3, 3), bodyMat);
    body.position.y = 0.66;
    const cabin = new THREE.Mesh(round(1.72, 0.62, 2.2, 0.28, 3), southGlassMat);
    cabin.position.set(0, 1.2, -0.1);
    car.add(body, cabin);
    const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    wg.rotateZ(Math.PI / 2);
    [
      [0.95, 1.35],
      [-0.95, 1.35],
      [0.95, -1.35],
      [-0.95, -1.35],
    ].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wg, southTireMat);
      wheel.position.set(x, 0.36, z);
      car.add(wheel);
    });
    car.position.set(336 + index * 5, 0, -398);
    car.rotation.y = Math.PI / 2;
    clientSite.add(car);
  });
  // paletes, cones e contêiner no pátio do cliente
  const yardBoxMat = new THREE.MeshStandardMaterial({ color: 0xc9a877, roughness: 0.95 });
  const yardPalletMat = new THREE.MeshStandardMaterial({ color: 0xa77b4c, roughness: 0.95 });
  [
    [368, -356.6, 2],
    [378, -356.6, 3],
    [410, -356.6, 1],
  ].forEach(([x, z, count]) => {
    const base = new THREE.Mesh(round(1.3, 0.14, 1.1, 0.04, 1), yardPalletMat);
    base.position.set(x, 0.07, z);
    clientSite.add(base);
    for (let k = 0; k < count; k += 1) {
      const box = new THREE.Mesh(round(1.1, 0.8, 0.9, 0.04, 1), yardBoxMat);
      box.position.set(x, 0.54 + k * 0.82, z);
      clientSite.add(box);
    }
  });
  const yardConeMat = new THREE.MeshStandardMaterial({ color: 0xf07a2a, roughness: 0.6 });
  for (let i = 0; i < 7; i += 1) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.66, 12), yardConeMat);
    cone.position.set(352 + i * 12, 0.33, -364.5);
    clientSite.add(cone);
  }
  const container = new THREE.Mesh(round(6, 2.6, 2.4, 0.08, 1), new THREE.MeshStandardMaterial({ color: 0x3f6a7d, roughness: 0.7, metalness: 0.3 }));
  container.position.set(452, 1.3, -394);
  container.rotation.y = 0.12;
  clientSite.add(container);

  // postes de luz do pátio
  [344, 372, 400, 428, 450].forEach((x) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), poleMat);
    pole.position.set(x, 3.5, -402);
    clientSite.add(pole);
    const head = new THREE.Mesh(round(1.2, 0.16, 0.5, 0.06, 1), lampMat);
    head.position.set(x, 7, -401.2);
    clientSite.add(head);
  });
  // cerca do pátio
  for (let x = 322; x <= 462; x += 4) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), guardMat);
    post.position.set(x, 0.8, -408);
    clientSite.add(post);
  }
  const fenceRail = new THREE.Mesh(new THREE.BoxGeometry(140, 0.08, 0.08), guardMat);
  fenceRail.position.set(392, 1.5, -408);
  clientSite.add(fenceRail);
  // empilhadeira do cliente
  const clientForklift = new THREE.Group();
  const cfBody = new THREE.Mesh(round(1.9, 1.3, 2.8, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0xf0b13a, roughness: 0.5, metalness: 0.35 }));
  cfBody.position.y = 1.05;
  clientForklift.add(cfBody);
  const cfMast = new THREE.Mesh(round(0.35, 3.2, 0.3, 0.1, 2), trimMat);
  cfMast.position.set(0, 1.9, 1.35);
  clientForklift.add(cfMast);
  const cfSeat = new THREE.Mesh(round(0.8, 0.7, 0.8, 0.2, 2), trimMat);
  cfSeat.position.set(0, 1.95, -0.3);
  clientForklift.add(cfSeat);
  const cfWheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14);
  cfWheelGeo.rotateZ(Math.PI / 2);
  [
    [0.9, 1],
    [-0.9, 1],
    [0.9, -0.9],
    [-0.9, -0.9],
  ].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(cfWheelGeo, southTireMat);
    wheel.position.set(x, 0.42, z);
    clientForklift.add(wheel);
  });
  const loadPallet = new THREE.Group();
  const palletBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 1.1), palletMat);
  palletBase.position.y = 0.08;
  const loadBox = new THREE.Mesh(round(1.2, 0.95, 1, 0.04, 1), boxMat);
  loadBox.position.y = 0.63;
  loadPallet.add(palletBase, loadBox);
  loadPallet.position.set(0, 0.25, 2);
  loadPallet.visible = false;
  clientForklift.add(loadPallet);
  clientForklift.position.set(410, 0, -366);
  clientForklift.rotation.y = Math.PI / 2;
  clientSite.add(clientForklift);

  // escritório de recebimento do cliente (tela com o dashboard)
  const clientOffice = new THREE.Group();
  clientOffice.position.set(446, 0, -368);
  clientSite.add(clientOffice);
  const coShell = new THREE.Mesh(round(16, 9, 14, 0.4, 3), wallMat);
  coShell.position.y = 4.5;
  clientOffice.add(coShell);
  const coRoof = new THREE.Mesh(round(17, 0.5, 15, 0.25, 2), roofMat);
  coRoof.position.y = 9.2;
  clientOffice.add(coRoof);
  const coGlass = new THREE.Mesh(
    round(10, 6.4, 0.2, 0.1, 2),
    new THREE.MeshStandardMaterial({ color: 0xcfe6ee, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.2 }),
  );
  coGlass.position.set(0, 4.2, -7.05);
  clientOffice.add(coGlass);
  const coAwning = new THREE.Mesh(round(17, 0.3, 3, 0.12, 2), roofMat);
  coAwning.position.set(0, 9.3, -7.6);
  clientOffice.add(coAwning);
  // fachada: porta, janelas e faixa
  const coDoor = new THREE.Mesh(round(0.16, 2.7, 1.7, 0.06, 2), southGlassMat);
  coDoor.position.set(-8.06, 1.35, 5.4);
  clientOffice.add(coDoor);
  const coWinMat = new THREE.MeshStandardMaterial({ color: 0x223029, roughness: 0.15, metalness: 0.8 });
  [-5.6, 5.6].forEach((dz) => {
    const win = new THREE.Mesh(round(0.14, 2.1, 3, 0.05, 1), coWinMat);
    win.position.set(-8.06, 5.6, dz);
    clientOffice.add(win);
  });
  const coBand = new THREE.Mesh(round(0.1, 0.18, 15.6, 0.04, 1), new THREE.MeshBasicMaterial({ color: BRAND }));
  coBand.position.set(-8.04, 8.2, 0);
  clientOffice.add(coBand);
  const coPlinth = new THREE.Mesh(round(16.6, 0.7, 14.6, 0.2, 2), trimMat);
  coPlinth.position.set(0, 0.35, 0);
  clientOffice.add(coPlinth);
  const coLight = new THREE.PointLight(0xfff3dd, 26, 30, 2);
  coLight.position.set(0, 6.5, 4);
  clientOffice.add(coLight);

  // trajeto completo do caminhão protagonista (avenida -> trevo -> via expressa -> periferia -> cliente)
  const heroRoute = new THREE.CatmullRomCurve3(
    HERO_ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
    0.5,
  );
  const heroRouteLength = heroRoute.getLength();
  const heroSamples = 1600;
  const heroSpaced = heroRoute.getSpacedPoints(heroSamples);
  const heroPointPhases: number[] = [];
  {
    let cursor = 0;
    HERO_ROUTE.forEach(([x, z]) => {
      let best = Infinity;
      let bestIndex = cursor;
      for (let i = cursor; i < heroSpaced.length; i += 1) {
        const dx = heroSpaced[i].x - x;
        const dz = heroSpaced[i].z - z;
        const d = dx * dx + dz * dz;
        if (d < best) {
          best = d;
          bestIndex = i;
        }
      }
      cursor = bestIndex;
      heroPointPhases.push(bestIndex / heroSamples);
    });
  }
  const heroPhaseAt = (waypoint: number) => heroPointPhases[Math.max(0, Math.min(heroPointPhases.length - 1, waypoint))];
  // paradas nos semáforos da avenida e no trevo: fase em que a frente do caminhão chega à faixa
  const heroStops: number[] = [];
  [42, 30, -42, -96, -150].forEach((crossZ) => {
    const limit = crossZ + 8.6;
    const index = heroSpaced.findIndex((pt) => pt.x < -2 && pt.z <= limit);
    if (index > 0) heroStops.push(index / heroSamples);
  });
  {
    const index = heroSpaced.findIndex((pt) => pt.z <= -181);
    if (index > 0) heroStops.push(index / heroSamples);
  }
  heroStops.sort((a, b) => a - b);
  function heroPhaseFor(progress: number) {
    if (progress <= HERO_ROUTE_KEYS[0][0]) return 0;
    for (let k = 0; k < HERO_ROUTE_KEYS.length - 1; k += 1) {
      const [pa, wa] = HERO_ROUTE_KEYS[k];
      const [pb2, wb] = HERO_ROUTE_KEYS[k + 1];
      if (progress <= pb2) {
        const raw = clamp01((progress - pa) / (pb2 - pa));
        const t = raw * raw * (3 - 2 * raw);
        return lerp(heroPhaseAt(wa), heroPhaseAt(wb), t);
      }
    }
    return heroPhaseAt(HERO_ROUTE_KEYS[HERO_ROUTE_KEYS.length - 1][1]);
  }

  const truck = new THREE.Group();
  const proceduralBodies: { group: THREE.Group; parts: THREE.Object3D[] }[] = [];
  type GlbRequest = {
    key: string;
    holder: THREE.Group;
    parts?: THREE.Object3D[];
    length: number;
    rotY: number;
    color?: number;
    label?: string;
    wheelScale?: number;
    wheelSpin?: THREE.Object3D[];
    livery?: boolean;
    keepWheels?: boolean;
  };
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
  tagCtx.fillText("PEDIDO #4821 · INDO PARA O CLIENTE", 74, 128);
  tagCtx.fillStyle = "rgba(244,248,239,0.55)";
  tagCtx.font = "500 22px Inter, sans-serif";
  tagCtx.fillText("Tracking em tempo real · getTMS", 74, 166);
  const tagTex = track(new THREE.CanvasTexture(tagCanvas));
  tagTex.colorSpace = THREE.SRGBColorSpace;
  const tagSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthWrite: false, depthTest: true }));
  tagSprite.scale.set(6.4, 2, 1);
  tagSprite.position.set(0, 7.2, -2);
  truck.add(tagSprite);

  const doneCanvas = document.createElement("canvas");
  doneCanvas.width = 640;
  doneCanvas.height = 200;
  const doneCtx = doneCanvas.getContext("2d")!;
  doneCtx.fillStyle = "rgba(10,16,11,0.92)";
  doneCtx.beginPath();
  doneCtx.roundRect(8, 8, 624, 184, 28);
  doneCtx.fill();
  doneCtx.fillStyle = "#8fe04a";
  doneCtx.beginPath();
  doneCtx.arc(46, 66, 12, 0, Math.PI * 2);
  doneCtx.fill();
  doneCtx.fillStyle = "#f4f8ef";
  doneCtx.font = "700 44px Sora, Inter, sans-serif";
  doneCtx.textBaseline = "middle";
  doneCtx.fillText("GT-1024", 74, 66);
  doneCtx.fillStyle = "#8fe04a";
  doneCtx.font = "600 26px Inter, sans-serif";
  doneCtx.fillText("200 PEDIDOS · 200 CT-e · ENTREGUE", 74, 128);
  doneCtx.fillStyle = "rgba(244,248,239,0.55)";
  doneCtx.font = "500 22px Inter, sans-serif";
  doneCtx.fillText("Comprovante assinado · 14:38 · getTMS", 74, 166);
  const doneTex = track(new THREE.CanvasTexture(doneCanvas));
  doneTex.colorSpace = THREE.SRGBColorSpace;
  const doneSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: doneTex, transparent: true, depthWrite: false, depthTest: false }));
  doneSprite.scale.set(8.6, 2.7, 1);
  doneSprite.position.set(0, 7.8, -2);
  doneSprite.visible = false;
  truck.add(doneSprite);

  const headGlow = new THREE.PointLight(0xffe7b0, 26, 26, 2);
  headGlow.position.set(0, 1.9, 6.4);
  truck.add(headGlow);

  truck.scale.setScalar(1);
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

  van.position.set(-1.4, 0, -110);
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
  const pantMat = new THREE.MeshStandardMaterial({ color: 0x27302a, roughness: 0.85 });

  const skinMats = [
    new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xa9744f, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x6f4a32, roughness: 0.8 }),
  ];

  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1b1f1c, roughness: 0.7 });
  const hairMats = [0x241b14, 0x3f2c1d, 0x141110, 0x5b4130, 0x8a6b4a].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
  );
  function addPerson(
    x: number,
    z: number,
    rotation: number,
    vest: number,
    walkAxis: "z" | "x" | null = null,
    walkRange = 3,
    delay = 0,
    worker = false,
  ) {
    const group = new THREE.Group();
    const shirtMat = new THREE.MeshStandardMaterial({ color: vest, roughness: 0.74 });
    const skinMat = skinMats[people.length % skinMats.length];
    // cabeça, cabelo ou capacete
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 14), skinMat);
    head.position.y = 1.64;
    const hair = worker
      ? new THREE.Mesh(
          new THREE.SphereGeometry(0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.45 }),
        )
      : new THREE.Mesh(
          new THREE.SphereGeometry(0.172, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
          hairMats[people.length % hairMats.length],
        );
    hair.position.y = worker ? 1.655 : 1.645;
    // tronco e quadril
    const torso = new THREE.Mesh(round(0.42, 0.6, 0.25, 0.1, 2), shirtMat);
    torso.position.y = 1.16;
    const hips = new THREE.Mesh(round(0.36, 0.26, 0.24, 0.07, 2), pantMat);
    hips.position.y = 0.82;
    // pernas com pivô no quadril + sapatos
    const legGeo = round(0.145, 0.72, 0.16, 0.06, 1);
    const shoeGeo = round(0.16, 0.11, 0.31, 0.05, 1);
    const makeLeg = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.1, 0.82, 0);
      const leg = new THREE.Mesh(legGeo, pantMat);
      leg.position.y = -0.36;
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(0, -0.76, 0.06);
      pivot.add(leg, shoe);
      return pivot;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);
    // braços com pivô no ombro
    const armGeo = round(0.11, 0.56, 0.12, 0.05, 1);
    const makeArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.28, 1.4, 0);
      const arm = new THREE.Mesh(armGeo, shirtMat);
      arm.position.y = -0.28;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skinMat);
      hand.position.y = -0.57;
      pivot.add(arm, hand);
      return pivot;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);
    group.add(head, hair, torso, hips, legL, legR, armL, armR);
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
  const pedestrianSpots: Array<[number, number, number]> = [
    [7.2, -60, Math.PI], [7.2, -34, Math.PI], [7.2, -8, Math.PI], [7.2, 20, Math.PI],
    [-7.2, -52, 0], [-7.2, -26, 0], [-7.2, 2, 0], [-7.2, 30, 0],
    [14, -70, Math.PI * 0.5], [-14, 12, -Math.PI * 0.5], [20, 34, Math.PI],
    [-20, -60, 0], [9.5, 44, Math.PI], [-9.5, -80, 0],
  ];
  pedestrianSpots.forEach(([px, pz, pr], i) => {
    addPerson(px, pz, pr, i % 2 === 0 ? 0x2f6f4f : 0x8fd14f, i % 3 === 0 ? "z" : null, 4, i * 0.4, i % 2 === 0);
  });
  // pedestres circulando nas calçadas da avenida
  const walkerVests = [0x2f6f4f, 0x8fd14f, 0x3a6ea5, 0xc0563c, 0xd9b23a, 0x4a4f58];
  for (let i = 0; i < 12; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const z = 56 - i * 16.5;
    addPerson(side * 9.6, z, side > 0 ? Math.PI : 0, walkerVests[i % walkerVests.length], "z", 7 + (i % 4) * 2, 0.2 + i * 0.12, false);
  }
  // pedestres na periferia e no pátio do cliente
  [[296.8, -252, 0], [307.2, -268, Math.PI], [296.8, -312, 0], [307.2, -330, Math.PI], [316, -352, Math.PI / 2]].forEach(
    ([px, pz, pr], i) => {
      addPerson(px, pz, pr, walkerVests[i % walkerVests.length], "z", 5, 0.4 + i * 0.2);
    },
  );



  // ---------------------------------------------------------------- carros
  type Car = { group: THREE.Group; wheels: THREE.Mesh[]; speed: number; offset: number; lane: number; dir: number; delay: number; z: number; v: number };
  const cars: Car[] = [];

  const carVariants = ["car-sedan", "car-hatchback", "car-suv", "car-ev"];
  let carVariantIndex = 0;
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
    shadow.visible = false;
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.12;
    group.add(shadow);

    group.position.set(lane, 0, 40);
    group.rotation.y = dir > 0 ? 0 : Math.PI;
    group.scale.setScalar(0.001);
    scene.add(group);
    // corpo detalhado do carro (GLB) no lugar da caixa procedural
    const variant = carVariants[carVariantIndex % carVariants.length];
    carVariantIndex += 1;
    queueGlb({
      key: variant,
      holder: group,
      parts: group.children.filter((child) => child !== shadow),
      length: 4.3,
      rotY: 0,
      color,
      keepWheels: true,
    });
    // motorista e passageiro sentados nos bancos da frente
    const seatDriverMat = new THREE.MeshStandardMaterial({ color: 0x2b333a, roughness: 0.85 });
    const seatPassengerMat = new THREE.MeshStandardMaterial({ color: 0x7c8794, roughness: 0.85 });
    const skinSeatMat = new THREE.MeshStandardMaterial({ color: 0xd8a87f, roughness: 0.7 });
    [-0.42, 0.42].forEach((dx, seat) => {
      const torso = new THREE.Mesh(round(0.34, 0.44, 0.3, 0.1, 1), seat === 0 ? seatDriverMat : seatPassengerMat);
      torso.position.set(dx, 0.74, 0.3);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), skinSeatMat);
      head.position.set(dx, 1.02, 0.3);
      group.add(torso, head);
    });
    const startZ = dir > 0 ? lerp(-130, 50, offset) : lerp(50, -130, offset);
    cars.push({ group, wheels: carWheels, speed, offset, lane, dir, delay, z: startZ, v: speed * 180 });
  }

  addCar(0xffffff, 1.5, 1, 0.055, 0.15, 0.06);
  addCar(0x63b32e, 1.5, 1, 0.042, 0.62, 0.08);
  addCar(0x2f3a34, -1.5, -1, 0.05, 0.35, 0.07);
  addCar(0xc9d2d6, -1.5, -1, 0.061, 0.78, 0.05);
  addCar(0x1f3a44, 1.5, 1, 0.047, 0.28, 0.09);
  addCar(0xb03a2e, -1.5, -1, 0.038, 0.05, 0.1);
  addCar(0xe8e3d6, 1.5, 1, 0.066, 0.88, 0.06);
  addCar(0x4a4f58, 1.5, 1, 0.036, 0.45, 0.11);
  addCar(0x2f6f4f, -1.5, -1, 0.055, 0.6, 0.08);
  addCar(0xe8ede4, -1.5, -1, 0.038, 0.82, 0.09);

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

  const truckVariants = ["semi-truck-low"]; // LOD: tráfego usa malha simplificada
  // padrão único: mesmo modelo e mesmo comprimento para todo caminhão da cena
  const TRUCK_LENGTH = 12.5;
  const truckLengths: Record<string, number> = { "semi-truck": TRUCK_LENGTH };
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
    const proceduralParts: THREE.Object3D[] = [];

    const simpleWheel = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 22);
    simpleWheel.rotateZ(Math.PI / 2);
    [5.35, 1.55, -5.6, -7.4].forEach((z) => {
      [-1.34, 1.34].forEach((x) => {
        const wheel = new THREE.Mesh(simpleWheel, tireMat);
        wheel.position.set(x, 0.62, z);
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
    proceduralBodies.push({ group, parts: group.children.filter((child) => child !== shadow) });
    const variant = truckVariants[truckVariantIndex % truckVariants.length];
    const color = truckColors[truckVariantIndex % truckColors.length];
    truckVariantIndex += 1;
    proceduralParts.push(...group.children.filter((child) => child !== shadow));
    queueGlb({
      key: variant,
      holder: group,
      parts: proceduralParts,
      length: truckLengths[variant] ?? TRUCK_LENGTH,
      rotY: 0,
      color,
      label: name,
      keepWheels: true,
    });
    return group;
  }

  // ---------------------------------------------------------------- aeroporto
  const airport = new THREE.Group();
  airport.position.set(0, 0, 0);
  scene.add(airport);
  const runwayCanvas = document.createElement("canvas");
  runwayCanvas.width = 1024;
  runwayCanvas.height = 256;
  const rw = runwayCanvas.getContext("2d")!;
  rw.fillStyle = "#4a5350";
  rw.fillRect(0, 0, 1024, 256);
  rw.fillStyle = "rgba(255,255,255,0.85)";
  for (let x = 40; x < 984; x += 90) rw.fillRect(x, 122, 54, 12);
  rw.fillRect(18, 30, 10, 196);
  rw.fillRect(996, 30, 10, 196);
  for (let y = 40; y < 230; y += 34) {
    rw.fillRect(40, y, 44, 8);
    rw.fillRect(940, y, 44, 8);
  }
  const runwayTex = track(new THREE.CanvasTexture(runwayCanvas));
  runwayTex.colorSpace = THREE.SRGBColorSpace;
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(170, 26), new THREE.MeshStandardMaterial({ map: runwayTex, roughness: 0.95 }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-252, 0.06, 34);
  airport.add(runway);
  const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(8, 30), new THREE.MeshStandardMaterial({ color: 0x4f5854, roughness: 0.95 }));
  taxiway.rotation.x = -Math.PI / 2;
  taxiway.position.set(-252, 0.05, 60);
  airport.add(taxiway);
  // terminal
  const apGlass = new THREE.MeshStandardMaterial({ color: 0x2f4a52, roughness: 0.18, metalness: 0.7 });
  const apWall = new THREE.MeshStandardMaterial({ color: 0xeef1e7, roughness: 0.8 });
  const terminal = new THREE.Mesh(round(40, 9, 14, 0.4, 2), apWall);
  terminal.position.set(-252, 4.5, 78);
  airport.add(terminal);
  const terminalGlass = new THREE.Mesh(round(38, 3.4, 0.3, 0.1, 1), apGlass);
  terminalGlass.position.set(-252, 4.6, 70.9);
  airport.add(terminalGlass);
  const terminalRoof = new THREE.Mesh(round(42, 0.6, 16, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0xcfd6cc, roughness: 0.7 }));
  terminalRoof.position.set(-252, 9.3, 78);
  airport.add(terminalRoof);
  const airportSign = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 5.5),
    new THREE.MeshBasicMaterial({ map: track(makeShopSignTexture("AEROPORTO", "#1f3a44", "#ffffff")) }),
  );
  airportSign.position.set(-252, 7.4, 70.8);
  airport.add(airportSign);
  // torre de controle
  const towerStem = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 18, 12), apWall);
  towerStem.position.set(-200, 9, 78);
  airport.add(towerStem);
  const towerCab = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 3.4, 12), apGlass);
  towerCab.position.set(-200, 19.4, 78);
  airport.add(towerCab);
  const towerRoof = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xcfd6cc, roughness: 0.7 }));
  towerRoof.position.set(-200, 21.3, 78);
  airport.add(towerRoof);
  const towerAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), trimMat);
  towerAntenna.position.set(-200, 24.5, 78);
  airport.add(towerAntenna);
  // hangar
  const hangar = new THREE.Mesh(round(26, 9, 18, 0.4, 2), new THREE.MeshStandardMaterial({ color: 0xdfe4d8, roughness: 0.85 }));
  hangar.position.set(-302, 4.5, 78);
  airport.add(hangar);
  const hangarRoof = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 26, 14, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc6cec2, roughness: 0.7 }));
  hangarRoof.rotation.z = Math.PI / 2;
  hangarRoof.position.set(-302, 9, 78);
  airport.add(hangarRoof);
  // luzes da pista
  const runwayLightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (let i = 0; i <= 18; i += 1) {
    [-1, 1].forEach((side) => {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), runwayLightMat);
      light.position.set(-337 + i * 9.4, 0.25, 34 + side * 13.6);
      airport.add(light);
    });
  }
  // avião estacionado
  const makePlane = (livery: number) => {
    const plane = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: livery, roughness: 0.35, metalness: 0.45 });
    const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 15, 6, 12), skin);
    fuselage.rotation.z = Math.PI / 2;
    fuselage.position.y = 2.2;
    plane.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.4, 12), skin);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(9.4, 2.2, 0);
    plane.add(nose);
    const wing = new THREE.Mesh(round(4.6, 0.35, 15, 0.2, 1), skin);
    wing.position.set(0.4, 2.1, 0);
    plane.add(wing);
    const tail = new THREE.Mesh(round(3.2, 0.3, 4.6, 0.15, 1), skin);
    tail.position.set(-7.4, 3.4, 0);
    plane.add(tail);
    const fin = new THREE.Mesh(round(0.35, 3, 3, 0.1, 1), skin);
    fin.position.set(-7.6, 4.8, 0);
    plane.add(fin);
    const windows = new THREE.Mesh(round(0.3, 0.4, 11, 0.1, 1), apGlass);
    windows.position.set(1, 2.6, 1.52);
    plane.add(windows);
    const windows2 = windows.clone();
    windows2.position.z = -1.52;
    plane.add(windows2);
    const engineGeo = new THREE.CylinderGeometry(0.9, 0.9, 3.2, 10);
    engineGeo.rotateX(Math.PI / 2);
    [-5.2, 5.2].forEach((z) => {
      const engine = new THREE.Mesh(engineGeo, skin);
      engine.position.set(1.4, 1.4, z);
      plane.add(engine);
    });
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6), trimMat);
    gear.position.set(1.5, 0.8, 0);
    plane.add(gear);
    return plane;
  };
  const parkedPlane = makePlane(0xf2f5ee);
  parkedPlane.position.set(-268, 0, 66);
  parkedPlane.rotation.y = -0.2;
  airport.add(parkedPlane);
  const taxiPlane = makePlane(0xdfe9f2);
  taxiPlane.position.set(-320, 0, 34);
  taxiPlane.rotation.y = 0;
  airport.add(taxiPlane);

  // ---------------------------------------------------------------- margem da via expressa: posto, pátio e armazém
  const roadside = new THREE.Group();
  scene.add(roadside);
  const rsWall = new THREE.MeshStandardMaterial({ color: 0xf1f3ea, roughness: 0.8 });
  const rsDark = new THREE.MeshStandardMaterial({ color: 0x39443c, roughness: 0.5, metalness: 0.4 });
  const rsCanopy = new THREE.MeshStandardMaterial({ color: 0xf7f9f3, roughness: 0.6 });
  // piso do posto
  const forecourt = new THREE.Mesh(new THREE.PlaneGeometry(64, 22), new THREE.MeshStandardMaterial({ color: 0x9aa39a, roughness: 0.95 }));
  forecourt.rotation.x = -Math.PI / 2;
  forecourt.position.set(132, 0.05, -176);
  roadside.add(forecourt);
  // cobertura
  const canopy = new THREE.Mesh(round(20, 0.9, 11, 0.2, 2), rsCanopy);
  canopy.position.set(124, 6.4, -176);
  roadside.add(canopy);
  const canopyStripe = new THREE.Mesh(round(20.2, 0.5, 0.6, 0.1, 1), new THREE.MeshStandardMaterial({ color: BRAND, roughness: 0.6 }));
  canopyStripe.position.set(124, 6.9, -171);
  roadside.add(canopyStripe);
  [[116, -172], [132, -172], [116, -180], [132, -180]].forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6, 0.55), rsWall);
    pillar.position.set(px, 3, pz);
    roadside.add(pillar);
  });
  // bombas
  [118, 124, 130].forEach((px) => {
    const pump = new THREE.Mesh(round(1.1, 1.9, 0.7, 0.12, 1), rsDark);
    pump.position.set(px, 1, -176);
    roadside.add(pump);
    const pumpTop = new THREE.Mesh(round(1.2, 0.4, 0.8, 0.08, 1), new THREE.MeshStandardMaterial({ color: BRAND, roughness: 0.5 }));
    pumpTop.position.set(px, 2.1, -176);
    roadside.add(pumpTop);
  });
  // loja de conveniência
  const store = new THREE.Mesh(round(11, 4.4, 7, 0.3, 2), rsWall);
  store.position.set(124, 2.2, -166);
  roadside.add(store);
  const storeGlass = new THREE.Mesh(round(9.6, 2.2, 0.2, 0.08, 1), new THREE.MeshStandardMaterial({ color: 0x2f3a34, roughness: 0.2, metalness: 0.6 }));
  storeGlass.position.set(124, 1.9, -169.6);
  roadside.add(storeGlass);
  const storeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 2.1),
    new THREE.MeshBasicMaterial({ map: track(makeShopSignTexture("POSTO · CONVENIÊNCIA", "#3f7d34", "#ffffff")) }),
  );
  storeSign.position.set(124, 3.5, -169.7);
  storeSign.rotation.y = Math.PI;
  roadside.add(storeSign);
  // armazém da beira da estrada
  const shed = new THREE.Mesh(round(34, 9, 14, 0.4, 2), wallMat);
  shed.position.set(205, 4.5, -170);
  roadside.add(shed);
  const shedRoof = new THREE.Mesh(round(35, 0.5, 15, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0xcfd6cc, roughness: 0.75 }));
  shedRoof.position.set(205, 9.2, -170);
  roadside.add(shedRoof);
  [-9, 0, 9].forEach((dx) => {
    const door = new THREE.Mesh(round(6, 5.2, 0.2, 0.1, 1), new THREE.MeshStandardMaterial({ color: 0x8d9690, roughness: 0.7, metalness: 0.3 }));
    door.position.set(205 + dx, 2.6, -177.1);
    roadside.add(door);
  });
  const shedSign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: track(makeShopSignTexture("ARMAZÉM 3", "#4a4f58", "#ffffff")) }),
  );
  shedSign.position.set(205, 7.2, -177.2);
  shedSign.rotation.y = Math.PI;
  roadside.add(shedSign);
  // caminhões estacionados no pátio
  [148, 160, 172].forEach((px, index) => {
    const parked = makeSimpleTruck(`GT-90${index + 1}`);
    parked.traverse((child) => {
      if ((child as THREE.Sprite).isSprite) child.visible = false;
    });
    parked.position.set(px, 0, -176);
    parked.rotation.y = Math.PI / 2;
    parked.scale.setScalar(1);
    roadside.add(parked);
  });
  // outdoors ao longo da estrada
  const billboardMessages = ["Menos custo. Mais controle.", "Simule seu frete em segundos.", "Tracking em tempo real."];
  billboardMessages.forEach((message, index) => {
    const board = new THREE.Group();
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 5),
      new THREE.MeshBasicMaterial({ map: track(makeShopSignTexture(message, index % 2 === 0 ? "#2f6f4f" : "#1f3a44", "#ffffff")) }),
    );
    panel.position.y = 7.2;
    board.add(panel);
    const frame = new THREE.Mesh(round(14.4, 5.4, 0.3, 0.1, 1), rsDark);
    frame.position.set(0, 7.2, -0.2);
    board.add(frame);
    [-4.5, 4.5].forEach((dx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), rsDark);
      leg.position.set(dx, 3.5, -0.3);
      board.add(leg);
    });
    board.position.set(78 + index * 92, 0, -188);
    board.rotation.y = Math.PI;
    roadside.add(board);
  });

  // caminhões extras circulando pela avenida
  const avenueTrucks: { group: THREE.Group; speed: number; offset: number; dir: number; lane: number; z: number }[] = [];
  [
    { name: "GT-5120", lane: 4.4, dir: -1, speed: 0.05, offset: 0.2 },
    { name: "GT-7788", lane: -4.4, dir: 1, speed: 0.045, offset: 0.55 },
    { name: "GT-3390", lane: 4.4, dir: -1, speed: 0.038, offset: 0.8 },
  ].forEach((item) => {
    const truckMesh = makeSimpleTruck(item.name);
    truckMesh.traverse((child) => {
      if ((child as THREE.Sprite).isSprite) child.visible = false;
    });
    truckMesh.rotation.y = item.dir > 0 ? 0 : Math.PI;
    truckMesh.scale.setScalar(1);
    truckMesh.position.set(item.lane, 0, item.dir > 0 ? -120 : 40);
    scene.add(truckMesh);
    avenueTrucks.push({ group: truckMesh, speed: item.speed, offset: item.offset, dir: item.dir, lane: item.lane, z: 0 });
  });

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
  const smallDockTrucks: { mesh: THREE.Group; baseX: number; phase: number }[] = [];
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
    [-9, 9].forEach((dx) => {
      const door = new THREE.Mesh(round(4.4, 4.4, 0.2, 0.08, 2), doorMat);
      door.position.set(dx, 2.4, 8.1);
      dc.add(door);
      const parked = makeSimpleTruck(["GT-1140", "GT-7788", "GT-9021"][(Math.round(dx / 9) + 1) % 3]);
      parked.position.set(dx, 0, 15);
      parked.rotation.y = 0;
      parked.scale.setScalar(1);
      dc.add(parked);
      smallDockTrucks.push({ mesh: parked, baseX: dx, phase: Math.abs(x) * 0.011 + (dx + 9) * 0.06 });
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
    visitor.scale.setScalar(1);
    visitor.position.set(0, 0, 42);
    dc.add(visitor);
    visitors.push({ mesh: visitor, phase: Math.abs(x) * 0.013 });

    scene.add(dc);
    return dc;
  }

  makeSmallDc(-112, -72, Math.PI * 0.5, "CD ALIMENTOS", 0x63b32e);
  makeSmallDc(-70, 72, Math.PI, "CD FARMA", 0x2f9e8f);
  makeSmallDc(-152, 0, Math.PI * 0.5, "CD CONSTRUÇÃO", 0xc08a3e);
  makeSmallDc(-116, -132, Math.PI * 0.5, "CD BETA", 0x39443a);
  makeSmallDc(-188, -26, Math.PI * 0.5, "CD GAMA", 0x2f6f4f);
  makeSmallDc(-176, 78, Math.PI, "CD DELTA", 0x39443a);
  makeSmallDc(-214, -104, Math.PI * 0.5, "CD ÔMEGA", 0x2f6f4f);
  makeSmallDc(104, 30, -Math.PI * 0.5, "CD E-COMMERCE", 0x4a6fd6);
  makeSmallDc(-52, -112, Math.PI, "CD LESTE", 0x2f6f4f);

  // tráfego contínuo na via
  function makeStatusTag(name: string, status: string, city: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 150;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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
    const dir = 1;
    vehicle.rotation.y = 0;
    vehicle.scale.setScalar(1);
    vehicle.position.set(4.4, 0, 0);
    vehicle.add(makeStatusTag(name, fleetStatus[index][0], fleetStatus[index][1]));
    scene.add(vehicle);
    return { mesh: vehicle, lane: 4.4, speed: 7 + index * 2, offset: index * 46, dir };
  });

  // caminhão já carregando na doca 5 do cliente
  const dockedTruck = makeCabOverSource();
  dockedTruck.position.set(424, 0, -361);
  dockedTruck.rotation.y = Math.PI;
  dockedTruck.scale.setScalar(1);
  clientSite.add(dockedTruck);

  // tráfego contínuo na via expressa e na periferia
  const highwayTraffic: { mesh: THREE.Group; lane: number; speed: number; offset: number; dir: number; from: number; to: number; x: number }[] = [];
  [
    { name: "GT-6410", lane: -191.6, speed: 16, offset: 60, dir: -1, from: 540, to: -30 },
    { name: "GT-7721", lane: -192.8, speed: 13, offset: 300, dir: -1, from: 540, to: -30 },
    { name: "GT-3908", lane: -189.2, speed: 15, offset: 190, dir: -1, from: 540, to: -30 },
    { name: "GT-5126", lane: -192.8, speed: 12, offset: 420, dir: -1, from: 540, to: -30 },
  ].forEach((item, index) => {
    const vehicle = makeSimpleTruck(item.name);
    vehicle.traverse((child) => {
      if ((child as THREE.Sprite).isSprite) child.visible = false;
    });
    vehicle.rotation.y = item.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    vehicle.scale.setScalar(1);
    vehicle.position.set(item.from, 0, item.lane);
    scene.add(vehicle);
    highwayTraffic.push({ mesh: vehicle, lane: item.lane, speed: item.speed, offset: item.offset, dir: item.dir, from: item.from, to: item.to, x: item.from + (item.dir > 0 ? item.offset : -item.offset) });
  });
  const peripheryTraffic: { mesh: THREE.Group; speed: number; offset: number; z: number }[] = [];
  ["GT-8810"].forEach((name) => {
    const vehicle = makeSimpleTruck(name);
    vehicle.rotation.y = 0;
    vehicle.scale.setScalar(0.8);
    vehicle.position.set(301.4, 0, -240);
    scene.add(vehicle);
    peripheryTraffic.push({ mesh: vehicle, speed: 4.2, offset: 0, z: 6 });
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
  dcSignCtx.fillText("CD AURORA", 1024, 140);
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

  // porta da doca onde o GT-1024 encosta: abre quando o caminhão dá ré
  const heroDoorIndex = dcDoorX.findIndex((x) => Math.abs(392 + x - DOCK_X) < 0.6);
  const heroDockDoor = heroDoorIndex >= 0 ? dcDoorMeshes[heroDoorIndex] : null;
  if (heroDoorIndex >= 0) {
    const doorX = dcDoorX[heroDoorIndex];
    const opening = new THREE.Mesh(round(5.1, 5.1, 0.08, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0x231d12 }));
    opening.position.set(doorX, 2.75, 10.94);
    clientDc.add(opening);
    const innerGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.5), new THREE.MeshBasicMaterial({ color: 0xffdfa4 }));
    innerGlow.position.set(doorX, 0.55, 10.9);
    clientDc.add(innerGlow);
  }
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

  const containerColors = ["#63b32e", "#2f6f4f", "#cfd8cf", "#f2f5ee", "#8aa86f", "#c4552f"];
  const containerGeo = round(6.1, 2.6, 2.5, 0.08, 1);
  const containerMats = containerColors.map((base) => {
    const texture = makeContainerTexture(base);
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.35 });
  });
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

  // painel de recebimento do cliente distante: mesma fonte de dados da plataforma
  const clientScreenMat = new THREE.MeshBasicMaterial({ map: heroTextures[2], transparent: true });
  const clientScreenBezel = new THREE.Mesh(
    round(0.18, 4.8, 9.2, 0.06, 2),
    new THREE.MeshStandardMaterial({ color: 0x1a211c, roughness: 0.5 }),
  );
  clientScreenBezel.position.set(-8.14, 4.9, 0);
  clientOffice.add(clientScreenBezel);
  const clientScreen = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 4.3), clientScreenMat);
  clientScreen.position.set(-8.26, 4.9, 0);
  clientScreen.rotation.y = -Math.PI / 2;
  clientOffice.add(clientScreen);
  const clientScreenTag = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1),
    makeTextPanel("RECEBIMENTO · DADOS EM TEMPO REAL", "", 6, 1, "#0f1a12", "#8fe04a"),
  );
  clientScreenTag.position.set(-8.3, 1.9, 0);
  clientScreenTag.rotation.y = -Math.PI / 2;
  clientOffice.add(clientScreenTag);
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
  const DC_CYCLE = 42;
  const DC_ARRIVE = 0.15;
  const DC_LEAVE = 0.8;
  const DC_GONE = 0.95;
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
    parked.position.set(doorX, 0, 20.2);
    parked.rotation.y = 0;
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

  // ---------------------------------------------------------------- caminhões clicáveis
  const clickableTrucks: { root: THREE.Object3D; info: TruckInfo }[] = [];
  const registerTruck = (root: THREE.Object3D, info: TruckInfo) => {
    clickableTrucks.push({ root, info });
  };
  registerTruck(truck, {
    plate: "GT-1024",
    order: "#4821",
    status: "Saindo do CD getTMS",
    route: "CD getTMS → Cliente Horizonte",
    driver: "Carlos M. · Scania R450",
    eta: "18 min",
  });
  avenueTrucks.forEach((item, index) => {
    const plate = ["GT-5120", "GT-7788", "GT-3390"][index];
    registerTruck(item.group, {
      plate,
      order: `#48${30 + index}`,
      status: index === 1 ? "Coleta no cliente" : "Em trânsito",
      route: index === 1 ? "Cliente Aurora → CD getTMS" : "CD getTMS → Cliente Norte",
      driver: ["Ana P.", "Rafael S.", "João V."][index] + " · Volvo FH",
      eta: `${9 + index * 6} min`,
    });
  });
  highwayTraffic.forEach((item, index) => {
    const plate = ["GT-6410", "GT-7721", "GT-3908", "GT-5126"][index];
    registerTruck(item.mesh, {
      plate,
      order: `#48${34 + index}`,
      status: "Em trânsito na via expressa",
      route: index % 2 === 0 ? "CD getTMS → Cliente Sul" : "Porto → CD getTMS",
      driver: ["Marcos L.", "Bruna T.", "Eduardo F.", "Paula R."][index] + " · Mercedes Actros",
      eta: `${22 + index * 7} min`,
    });
  });
  peripheryTraffic.forEach((item) => {
    registerTruck(item.mesh, {
      plate: "GT-8810",
      order: "#4844",
      status: "Última milha na periferia",
      route: "Cliente Horizonte → entregas locais",
      driver: "Lucas B. · Iveco Daily",
      eta: "6 min",
    });
  });
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const truckClickRef: { cb: ((info: TruckInfo) => void) | null } = { cb: null };
  let pointerDownAt: { x: number; y: number } | null = null;
  const pickTruck = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    let best: { info: TruckInfo; distance: number } | null = null;
    clickableTrucks.forEach(({ root, info }) => {
      if (!root.visible) return;
      const hits = raycaster.intersectObject(root, true);
      if (hits.length && (!best || hits[0].distance < best.distance)) best = { info, distance: hits[0].distance };
    });
    return best ? (best as { info: TruckInfo; distance: number }).info : null;
  };
  const onCanvasPointerDown = (event: PointerEvent) => {
    if (!insideCanvas(event) || overUi(event)) {
      pointerDownAt = null;
      return;
    }
    pointerDownAt = { x: event.clientX, y: event.clientY };
  };
  const onCanvasPointerUp = (event: PointerEvent) => {
    if (!pointerDownAt) return;
    const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    pointerDownAt = null;
    if (moved > 8 || !truckClickRef.cb) return;
    const info = pickTruck(event);
    if (info) truckClickRef.cb(info);
  };
  const insideCanvas = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  };
  const overUi = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    return !!target?.closest?.('button, a, input, textarea, select, [data-track-panel], [role="dialog"]');
  };
  let hoverFrame = 0;
  const onCanvasPointerMove = (event: PointerEvent) => {
    hoverFrame += 1;
    if (hoverFrame % 8 !== 0) return;
    if (!insideCanvas(event) || overUi(event)) {
      document.body.style.cursor = "";
      return;
    }
    document.body.style.cursor = pickTruck(event) ? "pointer" : "";
  };
  window.addEventListener("pointerdown", onCanvasPointerDown);
  window.addEventListener("pointerup", onCanvasPointerUp);
  window.addEventListener("pointermove", onCanvasPointerMove);

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
  const truckPoint = new THREE.Vector3();
  const truckTangent = new THREE.Vector3();
  const chasePos = new THREE.Vector3();
  const chaseLook = new THREE.Vector3();

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
    cidade: { pos: new THREE.Vector3(58, 86, 96), look: new THREE.Vector3(-30, 0, -6) },
    alimentos: { pos: new THREE.Vector3(58, 86, 96), look: new THREE.Vector3(-118, 3, -66) },
    farma: { pos: new THREE.Vector3(58, 86, 96), look: new THREE.Vector3(-76, 3, 78) },
    construcao: { pos: new THREE.Vector3(58, 86, 96), look: new THREE.Vector3(-158, 3, 6) },
    ecommerce: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    simulacao: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    ocorrencias: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    afericao: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
    relatorios: { pos: new THREE.Vector3(), look: new THREE.Vector3(), office: true },
  };
  let segmentView: { pos: THREE.Vector3; look: THREE.Vector3; office?: boolean } | null = null;
  let clearViewTimer = 0;
  const officePos = new THREE.Vector3();
  const officeQuat = new THREE.Quaternion();
  const officeFwd = new THREE.Vector3();
  const officeRight = new THREE.Vector3();
  let segmentZoom = 1;
  const segTarget = new THREE.Vector3();
  const followPos = new THREE.Vector3();
  const followLook = new THREE.Vector3();
  let camHeading = 0;
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

  function sampleChase(p: number) {
    let i = 0;
    while (i < CHASE_KEYS.length - 2 && p > CHASE_KEYS[i + 1].t) i += 1;
    const a = CHASE_KEYS[i];
    const b = CHASE_KEYS[i + 1];
    const raw = clamp01((p - a.t) / (b.t - a.t));
    const t = raw * raw * (3 - 2 * raw);
    return {
    geoAudit,
      ahead: lerp(a.ahead, b.ahead, t),
      height: lerp(a.height, b.height, t),
      side: lerp(a.side, b.side, t),
      look: lerp(a.look, b.look, t),
    };
  }

  let dockAnim = 0;
  function applyProgress(p: number, time: number) {
    const frameDt = Math.min(0.12, Math.max(0.001, time - lastFrameTime));
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

    applyWeather(p, time);
    // porta da doca abre e a empilhadeira carrega o caminhão
    if (heroDockDoor) {
      const openT = easeInOut(clamp01((dockAnim - 0.5) / 0.45));
      heroDockDoor.position.y = 2.8 + openT * 4.4;
      (heroDockDoor.material as THREE.MeshBasicMaterial).opacity = Math.max(1, (heroDockDoor.material as THREE.MeshBasicMaterial).opacity);
    }
    const loadIn = clamp01((dockAnim - 0.72) / 0.2);
    if (loadIn > 0) {
      const cycle = (time * 0.5) % 1;
      const k = easeInOut(cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2);
      clientForklift.position.set(THREE.MathUtils.lerp(406, DOCK_X + 2.2, k * loadIn), 0, THREE.MathUtils.lerp(-366, -356.5, k * loadIn));
      clientForklift.rotation.y = Math.PI / 2 + k * loadIn * Math.PI * 0.35;
      loadPallet.visible = k > 0.15 && k < 0.85;
    } else {
      loadPallet.visible = false;
    }
    // caminhão protagonista: avenida inteira -> trevo -> via expressa -> periferia -> doca do cliente
    const signalCycle = (time * 0.14) % 2;
    const signalGreen = signalCycle < 1.15;
    const routeTarget = heroPhaseFor(p);
    const routeGap = routeTarget - truckPhase;
    let truckStep = THREE.MathUtils.clamp(routeGap * 1.1, -0.2, 0.2);
    // saltos grandes de rolagem: o caminhão "acelera" para alcançar a cena
    if (Math.abs(routeGap) > 0.18) truckStep = THREE.MathUtils.clamp(routeGap * 1.8, -0.45, 0.45);
    if (Math.abs(routeGap) < 0.0035) truckStep = routeTarget > 0.995 ? 0 : 0.0045;
    // só obedece o semáforo quando está no ritmo da rolagem (quem rola rápido não fica preso)
    if (truckStep > 0 && !signalGreen && routeGap < 0.05) {
      for (const stop of heroStops) {
        if (stop > truckPhase && stop <= truckPhase + truckStep * frameDt + 0.0004) {
          truckStep = Math.max(0, (stop - truckPhase) / Math.max(frameDt, 0.001));
          break;
        }
      }
    }
    // chegou em frente à doca: segura o caminhão e dá ré com tempo para a manobra
    if (truckPhase >= DOCK_START - 0.0005 && routeTarget > 0.94) {
      dockAnim = Math.min(1, dockAnim + frameDt / 3.4);
    } else if (routeTarget < DOCK_START - 0.02) {
      dockAnim = Math.max(0, dockAnim - frameDt / 1.4);
    }
    const previousPhase = truckPhase;
    truckPhase = clamp01(Math.min(truckPhase + truckStep * frameDt, DOCK_START + 0.0005));
    truckSpeed = dockAnim > 0 && dockAnim < 1 ? 0.35 * (1 - dockAnim) : (truckPhase - previousPhase) / Math.max(frameDt, 0.001);
    heroRoute.getPointAt(Math.min(0.99999, truckPhase), truckPoint);
    heroRoute.getTangentAt(Math.min(0.99999, truckPhase), truckTangent);
    truck.position.set(truckPoint.x, 0, truckPoint.z);
    let targetHeading = Math.atan2(truckTangent.x, truckTangent.z);
    // manobra final: o caminhão encara a doca de frente para o sul e dá ré até encostar
    if (truckPhase >= DOCK_START - 0.0005 && dockAnim > 0) {
      const dockT = easeInOut(clamp01(dockAnim));
      truck.position.set(DOCK_X, 0, THREE.MathUtils.lerp(DOCK_STAGE_Z, DOCK_FINAL_Z, dockT));
      targetHeading = Math.PI;
    }
    let turnDelta = targetHeading - truck.rotation.y;
    while (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
    while (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
    truck.rotation.y += turnDelta * Math.min(1, frameDt * 5);
    truck.rotation.z = 0;
    truck.rotation.x = 0;
    truck.visible = true;
    wheelSpinAcc += truckSpeed * heroRouteLength * frameDt * 2;
    wheels.forEach((wheel) => {
      wheel.rotation.x = wheelSpinAcc;
    });
    smallDockTrucks.forEach((item) => {
      const cycle = ((time * 0.55 + item.phase) % 36) / 36;
      let a = 0;
      if (cycle < 0.16) a = cycle / 0.16;
      else if (cycle < 0.82) a = 1;
      else if (cycle < 0.96) a = 1 - (cycle - 0.82) / 0.14;
      const eased = a * a * a * (a * (a * 6 - 15) + 10);
      item.mesh.position.z = lerp(30, 15, eased);
      item.mesh.position.x = item.baseX;
      item.mesh.rotation.y = lerp(Math.PI, 0, THREE.MathUtils.smoothstep(eased, 0.25, 0.8));
    });
    visitors.forEach((item) => {
      // caminhão entra reto pela via de acesso e segue até a doca, sem girar
      const cycle = (time * 0.03 + item.phase) % 1;
      const t = cycle < 0.86 ? cycle / 0.86 : 1;
      const eased = t * t * (3 - 2 * t);
      item.mesh.position.z = lerp(56, 16.4, eased);
      item.mesh.position.x = 0;
      item.mesh.rotation.y = 0;
    });

    roadFleet.forEach((item, fleetIndex) => {
      const span = 238;
      const travelled = (time * item.speed + item.offset) % span;
      let z = -142 + travelled;
      // respeita o semaforo do cruzamento: para antes da faixa e espera o verde
      const stopZ = 20 + fleetIndex * 7;
      if (!signalGreen && z > stopZ && z < stopZ + 12) {
        z = stopZ;
      }
      item.mesh.position.z = z;
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
      const tier = tower.mesh.userData.tier as THREE.Mesh | undefined;
      const tierH = (tower.mesh.userData.tierH as number) || 0;
      if (tier) {
        tier.scale.y = Math.max(0.001, t);
        tier.position.y = tower.height * t + (tierH * t) / 2;
      }
      if (cap) {
        cap.scale.y = Math.max(0.001, t);
        cap.position.y = tower.height * t + tierH * t + 0.3;
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
      person.group.visible = person.base.z > -200 ? p > 0.04 : p > 0.78;
    });

    // carros
    cars.forEach((car) => {
      const t = easeOut(range(pb, 0.08 + car.delay, 0.16 + car.delay));
      car.group.scale.setScalar(Math.max(0.001, t));
      // direção assistida: acelera livre e freia atrás de quem está na frente
      const minGap = 9;
      let obstacle = Infinity;
      cars.forEach((other) => {
        if (other === car || other.dir !== car.dir) return;
        if (Math.abs(other.group.position.x - car.group.position.x) > 0.6) return;
        const ahead = (other.z - car.z) * car.dir;
        if (ahead > 0 && ahead < obstacle) obstacle = ahead;
      });
      // caminhões e o caminhão do hero também contam como obstáculo
      const heroGap = (truck.position.z - car.z) * car.dir;
      if (Math.abs(truck.position.x - car.group.position.x) < 2.6 && heroGap > 0 && heroGap < obstacle) obstacle = heroGap;
      avenueTrucks.forEach((item) => {
        if (item.dir !== car.dir) return;
        if (Math.abs(item.group.position.x - car.group.position.x) > 3) return;
        const ahead = (item.group.position.z - car.z) * car.dir;
        if (ahead > 0 && ahead < obstacle) obstacle = ahead;
      });
      const brakeStart = 26;
      const factor = obstacle >= brakeStart ? 1 : Math.max(0, (obstacle - minGap) / (brakeStart - minGap));
      car.z += car.dir * car.v * factor * frameDt;
      if (car.dir > 0 && car.z > 50) car.z -= 180;
      if (car.dir < 0 && car.z < -130) car.z += 180;
      car.group.position.z = car.z;
      car.wheels.forEach((wheel) => {
        wheel.rotation.x += car.speed * 40;
      });
      car.group.visible = t > 0.001;
    });

    // mantém distância entre veículos da mesma faixa (ninguém se bate)
    const spacing: Record<string, { z: number; dir: number; gap: number; set: (z: number) => void }[]> = {};
    cars.forEach((car) => {
      const key = `${car.group.position.x.toFixed(1)}:${car.dir}`;
      (spacing[key] ||= []).push({ z: car.group.position.z, dir: car.dir, gap: 8, set: (z) => { car.group.position.z = z; } });
    });
    avenueTrucks.forEach((item) => {
      const key = `${item.group.position.x.toFixed(1)}:${item.dir}`;
      (spacing[key] ||= []).push({ z: item.group.position.z, dir: item.dir, gap: 24, set: (z) => { item.group.position.z = z; } });
    });
    Object.values(spacing).forEach((list) => {
      if (list.length < 2) return;
      const dir = list[0].dir;
      // frente primeiro: quem tem o z mais adiantado no sentido do fluxo
      list.sort((a, b) => (dir > 0 ? b.z - a.z : a.z - b.z));
      for (let i = 1; i < list.length; i += 1) {
        const back = list[i];
        const front = list[i - 1];
        const required = front.z - dir * Math.max(front.gap, back.gap);
        if (dir > 0 ? back.z > required : back.z < required) back.set(required);
      }
    });
    // caminhões extras da avenida
    avenueTrucks.forEach((item) => {
      const progress = (time * item.speed + item.offset + p * 0.15) % 1;
      const z = item.dir > 0 ? lerp(-130, 50, progress) : lerp(50, -130, progress);
      const sameLane = Math.abs(item.group.position.x - truck.position.x) < 4.6;
      const gap = (z - truck.position.z) * item.dir;
      if (!(sameLane && gap > -17 && gap < 19)) item.group.position.z = z;
      item.group.visible = p < 0.66;
    });
    // avião taxia na pista do aeroporto
    taxiPlane.position.x = -330 + ((time * 0.028) % 1) * 158;
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
      // ciclo: desce devagar -> encosta de ré -> carrega -> sai -> aguarda
      const cycle = ((time + index * 8) % DC_CYCLE) / DC_CYCLE;
      let approach = 0;
      let docked = 0;
      if (cycle < DC_ARRIVE) {
        approach = cycle / DC_ARRIVE;
      } else if (cycle < DC_LEAVE) {
        approach = 1;
        docked = 1;
      } else if (cycle < DC_GONE) {
        approach = 1 - (cycle - DC_LEAVE) / (DC_GONE - DC_LEAVE);
      }
      // suavização quintica: começa e termina sem trancos
      const eased = approach * approach * approach * (approach * (approach * 6 - 15) + 10);
      const present = appear > 0.5;
      clone.visible = present;
      clone.scale.setScalar(Math.max(0.001, appear * 0.94));
      // desce pela via de serviço e entra na doca em curva, com a traseira para a porta
      const turn = THREE.MathUtils.smoothstep(eased, 0.22, 0.8);
      const curveX = (1 - (1 - eased) * (1 - eased)) * dockX;
      clone.position.z = lerp(66, 20.2, eased);
      clone.position.x = curveX + Math.sin(eased * Math.PI) * 0.5 * side;
      clone.rotation.y = lerp(Math.PI, 0, turn);
      const tag = clone.userData.orderTag as THREE.Sprite | undefined;
      if (tag) tag.visible = docked > 0.5 && cycle < DC_LEAVE;
    });
    dcDoorMeshes.forEach((door, index) => {
      const clone = dcTrucks[index === 2 || index === 3 ? (index === 2 ? 2 : 3) : index];
      let open = 0;
      if (clone) {
        const cycle = ((time + index * 8) % DC_CYCLE) / DC_CYCLE;
        open = cycle >= DC_ARRIVE && cycle < DC_LEAVE ? 1 : 0;
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

    // montagem do sul: trevo, via expressa, trecho rural, periferia e cliente
    revealFades.forEach((item) => {
      item.mat.opacity = item.base * easeOut(range(pb, item.from, item.to));
    });
    riseGroups.forEach((item) => {
      const t = easeOut(range(pb, item.from, item.to));
      item.group.scale[item.axis] = Math.max(0.001, t);
    });

    // semáforos trocam de cor junto com o ciclo
    signalLamps.forEach((lamp) => {
      lamp.red.color.setHex(signalGreen ? 0x3a1d18 : 0xff5a3c);
      lamp.green.color.setHex(signalGreen ? 0x8fe04a : 0x26341f);
    });

    // no encerramento a câmera sobe acima das nuvens: elas somem para não tapar a vista
    const cloudFade = 1 - clamp01((p - 0.972) / 0.018);
    // a vista de drone abre a neblina para enxergar a cidade inteira
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.0014 * (1 - 0.62 * clamp01((p - 0.965) / 0.03));
    }
    cloudMat.opacity = 0.92 * cloudFade;
    clouds.visible = cloudFade > 0.02;
    // tráfego da via expressa
    // inteligência de trânsito: freia quando o caminhão do cliente ou outro veículo está à frente
    const laneBlocked = (nextX: number, lane: number, dir: number, self: unknown) => {
      if (Math.abs(truck.position.z - lane) < 3.8) {
        const gap = (truck.position.x - nextX) * dir;
        if (gap > -9 && gap < 27) return true;
      }
      for (const other of highwayTraffic) {
        if ((other as unknown) === self) continue;
        if (Math.abs(other.lane - lane) > 1.5) continue;
        const gap = (other.x - nextX) * dir;
        if (gap > -9 && gap < 23) return true;
      }
      return false;
    };
    highwayTraffic.forEach((item, index) => {
      const span = Math.abs(item.to - item.from);
      const dir = item.dir;
      const nextX = item.x + dir * item.speed * frameDt;
      if (!laneBlocked(nextX, item.lane, dir, item)) item.x = nextX;
      if (dir > 0 && item.x >= item.to) item.x = item.from;
      if (dir < 0 && item.x <= item.to) item.x = item.from;
      item.mesh.position.set(item.x, 0, item.lane);
      item.mesh.visible = p > 0.3;
      if (index === 0) item.mesh.visible = p > 0.34;
    });
    peripheryTraffic.forEach((item) => {
      const span = 120;
      const nextZ = item.z + item.speed * frameDt;
      const heroGap = nextZ - truck.position.z;
      const heroSameStreet = Math.abs(truck.position.x - 301.4) < 6 && Math.abs(heroGap) < 24;
      if (!heroSameStreet) item.z = nextZ;
      if (item.z >= span) item.z -= span;
      item.mesh.position.set(301.4, 0, -366 + item.z);
      item.mesh.visible = p > 0.46;
    });

    // entrega no cliente: porta da doca abre, empilhadeira trabalha e etiqueta vira "entregue"
    const atClient = range(p, 0.74, 0.8);
    clientDoorMats.forEach((material, index) => {
      const active = index === 2 ? 1 : 0.55;
      material.opacity = atClient * active * (0.8 + Math.sin(time * 1.6 + index) * 0.15);
    });
    clientDoorMeshes.forEach((door, index) => {
      const open = index === 2 ? atClient : 0;
      door.scale.y = 1 - open * 0.92;
      door.position.y = 3 + open * 2.6;
    });
    const cfSwing = (time * 0.25) % 2;
    const cfPhase = cfSwing < 1 ? cfSwing : 2 - cfSwing;
    const cfEase = cfPhase * cfPhase * (3 - 2 * cfPhase);
    clientForklift.position.set(lerp(386, 395, cfEase), 0, lerp(-368, -359, cfEase));
    clientForklift.rotation.y = cfSwing < 1 ? 0 : Math.PI;
    const delivered = dockAnim > 0.97 && p > 0.86;
    doneSprite.visible = delivered;
    tagSprite.visible = !delivered && p < 0.83;
    if (clientScreenMat) clientScreenMat.opacity = easeOut(range(pb, 0.8, 0.9));

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

  let perfTime = 0;
  let perfFrames = 0;
  let perfAdjusted = low;
  let qualityIndex = 0;
  let halfRate = false;
  let halfSkip = false;
  let infoSince = performance.now();
  let infoFrames = 0;
  let infoUpdate = 0;
  let infoRender = 0;
  let sceneActive = true;
  let frameCount = 0;
  let lastDrawAt = 0;
  function mergeStaticChunks(root: THREE.Object3D) {
    // cada quadra/lote é um Group: fundir dentro dele reduz draw calls sem perder o culling por região
    const chunks = root.children.filter((child) => child.type === "Group") as THREE.Group[];
    chunks.forEach((chunk) => {
      let meshes = 0;
      chunk.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes += 1; });
      if (meshes > 6) mergeStatic(chunk);
    });
  }

  // reduz chamadas de desenho sem fundir a cidade inteira
  [city, skyline, periph].forEach((group) => mergeSiblings(group));

  fixDecals(scene);
  [city, periph].forEach((g) => instanceStatic(g));
  // congelamento seguro: só os grupos puramente estáticos (nada animado vive neles)
  [city, skyline, periph].forEach((root) => {
    root.updateMatrixWorld(true);
    root.traverse((o) => { o.matrixAutoUpdate = false; });
  });



  // culling por distância: detalhes pequenos e distantes deixam de ser desenhados
  const detailCull: { mesh: THREE.Mesh; radius: number }[] = [];
  city.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    if (size < 5) detailCull.push({ mesh, radius: low ? 120 : 170 });
    else if (size < 14) detailCull.push({ mesh, radius: low ? 190 : 260 });
  });
  let cullFrame = 0;
  let cullCursor = 0;
  const cullTmp = new THREE.Vector3();

  // agrupa apenas malhas irmãs com o mesmo material: menos chamadas sem perder o culling por quadra
  function mergeSiblings(root: THREE.Object3D) {
    const groups: THREE.Object3D[] = [];
    root.traverse((o) => { if (o !== root && o.children.length > 2) groups.push(o); });
    groups.forEach((parent) => {
      const buckets = new Map<string, THREE.Mesh[]>();
      parent.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || (mesh as unknown as { isSprite?: boolean }).isSprite || mesh.userData.dynamic) return;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (!mat) return;
        const list = buckets.get(mat.uuid) ?? [];
        list.push(mesh);
        buckets.set(mat.uuid, list);
      });
      buckets.forEach((list) => {
        if (list.length < 3) return;
        parent.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        const merged: THREE.BufferGeometry[] = [];
        list.forEach((mesh) => {
          const geo = mesh.geometry.clone();
          geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
          merged.push(geo);
        });
        const combined = mergeGeometries(merged, false);
        merged.forEach((g) => g.dispose());
        if (!combined) return; // nada é removido se a fusão não der certo
        list.forEach((mesh) => mesh.removeFromParent());
        const mesh = new THREE.Mesh(combined, list[0].material as THREE.Material);
        mesh.userData.dynamic = false;
        parent.add(mesh);
      });
    });
  }

  // decalques (faixas, placas, adesivos) sempre à frente da superfície: fim do z-fighting
  function fixDecals(root: THREE.Object3D) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry;
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const dims = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((a, b) => a - b);
      const flat = g.type === "PlaneGeometry" || dims[0] < 0.12;
      if (!flat) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const m = mat as THREE.Material & { polygonOffset?: boolean; polygonOffsetFactor?: number; polygonOffsetUnits?: number };
        if (!m) return;
        m.polygonOffset = true;
        m.polygonOffsetFactor = -4;
        m.polygonOffsetUnits = -4;
        m.needsUpdate = true;
      });
      mesh.renderOrder = Math.max(mesh.renderOrder, 2);
    });
  }

  function geoAudit() {
    const rows: { group: string; geos: number }[] = [];
    scene.children.forEach((child) => {
      let n = 0;
      child.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) n += 1; });
      if (n > 0) rows.push({ group: child.name || child.type, geos: n });
    });
    rows.sort((a, b) => b.geos - a.geos);
    return { total: rows.reduce((a, r) => a + r.geos, 0), rows: rows.slice(0, 12) };
  }

  (window as unknown as { __gettmsAudit?: () => unknown }).__gettmsAudit = geoAudit;

  // instancing: objetos estáticos que compartilham geometria e material viram uma chamada só
  function instanceStatic(root: THREE.Object3D) {
    const buckets = new Map<string, THREE.Mesh[]>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry || mesh.userData.dynamic) return;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!mat) return;
      const key = `${mesh.geometry.uuid}|${mat.uuid}`;
      const list = buckets.get(key) ?? [];
      list.push(mesh);
      buckets.set(key, list);
    });
    buckets.forEach((list) => {
      if (list.length < 8) return;
      const geo = list[0].geometry;
      const pos = geo.getAttribute("position");
      if (!pos || pos.count > 4000) return;
      const inst = new THREE.InstancedMesh(geo, (Array.isArray(list[0].material) ? list[0].material[0] : list[0].material) as THREE.Material, list.length);
      const m4 = new THREE.Matrix4();
      list.forEach((mesh, i) => {
        mesh.updateMatrixWorld(true);
        inst.setMatrixAt(i, m4.copy(mesh.matrixWorld));
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = true;
      inst.userData.dynamic = false;
      inst.name = "instanced";
      inst.matrixAutoUpdate = false;
      inst.updateMatrixWorld(true);
      list.forEach((mesh) => mesh.removeFromParent());
      scene.add(inst);
    });
  }

  function render() {
    if (disposed) return;
    if (!sceneActive || document.hidden) {
      frame = requestAnimationFrame(render);
      return;
    }
    const now = performance.now();
    lastDrawAt = now;
    cullFrame += 1;
    if (detailCull.length) {
      // varredura dividida: um oitavo da lista por quadro, custo fracionado e constante
      const camPos = camera.position;
      const slice = Math.ceil(detailCull.length / 8);
      for (let n = 0; n < slice; n += 1) {
        const item = detailCull[cullCursor];
        cullCursor = (cullCursor + 1) % detailCull.length;
        item.mesh.getWorldPosition(cullTmp);
        item.mesh.visible = cullTmp.distanceTo(camPos) < item.radius;
      }
    }
    frameCount += 1;
    perfFrames += 1;
    perfTime += Math.min(0.5, (now - lastTime) / 1000);
    if (perfTime > 2.5) {
      const fps = perfFrames / perfTime;
      const steps = [Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5), 1.15, 1, 0.8];
      if (fps < 45 && qualityIndex < steps.length - 1) {
        qualityIndex += 1;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, steps[qualityIndex]));
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        halfRate = qualityIndex >= steps.length - 1 && fps < 28;
        perfAdjusted = true;
      } else if (fps < 26 && qualityIndex >= steps.length - 1) {
        halfRate = true; // aparelhos muito fracos: metade dos quadros
      } else if (fps > 56 && halfRate) {
        halfRate = false;
      } else if (fps > 58 && qualityIndex > 0 && perfAdjusted) {
        qualityIndex -= 1;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, steps[qualityIndex]));
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        perfAdjusted = false;
      }
      perfTime = 0;
      perfFrames = 0;
    }
    if (halfRate) {
      halfSkip = !halfSkip;
      if (halfSkip) {
        frame = requestAnimationFrame(render);
        return;
      }
    }
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
    const chapterMids = [0.13, 0.25, 0.37, 0.48, 0.57, 0.63, 0.71, 0.8, 0.89, 0.97];
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

    // take cinematográfico: a câmera acompanha o caminhão da avenida até a doca do cliente
    const chaseIn = THREE.MathUtils.smoothstep(current, 0.25, 0.33);
    const chaseOut = 1 - THREE.MathUtils.smoothstep(current, 0.82, 0.885);
    const chaseW = segmentView ? 0 : chaseIn * chaseOut;
    if (chaseW > 0.001) {
      const chase = sampleChase(current);
      const rawHeading = truck.rotation.y;
      let deltaHeading = rawHeading - camHeading;
      while (deltaHeading > Math.PI) deltaHeading -= Math.PI * 2;
      while (deltaHeading < -Math.PI) deltaHeading += Math.PI * 2;
      camHeading += deltaHeading * Math.min(1, dt * 2.4);
      const fwdX = Math.sin(camHeading);
      const fwdZ = Math.cos(camHeading);
      const rightX = Math.cos(camHeading);
      const rightZ = -Math.sin(camHeading);
      const chasePull = aspect < 1.3 ? Math.min(1.7, 1.25 / aspect) : 1;
      chasePos.set(
        truck.position.x - fwdX * chase.ahead * chasePull + rightX * chase.side,
        chase.height * chasePull,
        truck.position.z - fwdZ * chase.ahead * chasePull + rightZ * chase.side,
      );
      chaseLook.set(
        truck.position.x + fwdX * chase.look,
        2.8,
        truck.position.z + fwdZ * chase.look,
      );
      camPos.lerp(chasePos, chaseW);
      lookTarget.lerp(chaseLook, chaseW);
    }

    camPos.x += smoothX * 2.6 * (1 - chaseW * 0.7);
    camPos.y += smoothY * 1.8 * (1 - chaseW * 0.7);

    if (!segmentView) {
      camera.position.copy(camPos);
      camera.lookAt(lookTarget);
    }
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
        overrideLook.lerp(segmentView.look, 0.08);
        camera.position.lerp(segTarget, 0.09);
        camera.lookAt(overrideLook);
      }
    }

    const t0 = performance.now();
    applyProgress(current, elapsed);
    const t1 = performance.now();
    if (!document.hidden) renderer.render(scene, camera);
    const t2 = performance.now();
    infoUpdate += (t1 - t0);
    infoRender += (t2 - t1);
    infoFrames += 1;
    if (now - infoSince > 1500) {
      (window as any).__gettmsInfo = {
        updateMs: +(infoUpdate / Math.max(1, infoFrames)).toFixed(2),
        renderMs: +(infoRender / Math.max(1, infoFrames)).toFixed(1),
        fps: +(1000 * infoFrames / (now - infoSince)).toFixed(1),
        calls: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        programs: renderer.info.programs?.length ?? 0,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        dpr: renderer.getPixelRatio(),
        shadows: renderer.shadowMap.enabled,
      };
      infoSince = now;
      infoFrames = 0;
      infoUpdate = 0;
      infoRender = 0;
    }
    frame = requestAnimationFrame(render);
  }

  resize();
  // pré-compila todos os shaders antes do filme começar (evita travadas no meio)
  try {
    renderer.compile(scene, camera);
  } catch {
    /* ignora */
  }
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
    const chassis = new THREE.Mesh(round(2.2, 0.42, 16, 0.08, 1), dark);
    chassis.position.set(0, 0.95, -1.0);
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
    trailer.position.set(0, 2.98, -2.9);
    root.add(trailer);
    const skirt = new THREE.Mesh(round(2.6, 0.55, 12.4, 0.08, 1), dark);
    skirt.position.set(0, 1.18, -2.9);
    root.add(skirt);
    const stripe = new THREE.Mesh(round(2.6, 0.16, 12.42, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0x63b32e }));
    stripe.position.set(0, 1.5, -2.9);
    root.add(stripe);
    const rear = new THREE.Mesh(round(2.5, 2.7, 0.14, 0.06, 1), dark);
    rear.position.set(0, 2.94, -9.12);
    root.add(rear);
    [-0.8, 0.8].forEach((x) => {
      const tail = new THREE.Mesh(cachedGeo("box:tail", () => new THREE.BoxGeometry(0.3, 0.16, 0.06)), rearLamp);
      tail.position.set(x, 1.32, -9.16);
      root.add(tail);
    });
    // rodas
    const tire = new THREE.MeshStandardMaterial({ color: 0x20241f, roughness: 0.9 });
    const rim = new THREE.MeshStandardMaterial({ color: 0xcfd4d6, roughness: 0.3, metalness: 0.8 });
    const wheelGeo = cachedGeo("wheel:062", () => new THREE.CylinderGeometry(0.62, 0.62, 0.4, 20));
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = cachedGeo("rim:034", () => new THREE.CylinderGeometry(0.34, 0.34, 0.42, 16));
    rimGeo.rotateZ(Math.PI / 2);
    [6.4, 0.6, -0.8, -8.4, -7.0, -5.6].forEach((z) => {
      [-1.12, 1.12].forEach((x) => {
        const wheel = new THREE.Mesh(wheelGeo, tire);
        wheel.position.set(x, 0.62, z);
        wheel.name = "wheel";
        root.add(wheel);
        const hub = new THREE.Mesh(rimGeo, rim);
        hub.position.set(x, 0.62, z);
        root.add(hub);
      });
    });
    // paralamas traseiros ligam as rodas à carreta
    [-8.4, -7.0, -5.6].forEach((z) => {
      const fender = new THREE.Mesh(round(2.5, 0.1, 1.5, 0.06, 1), dark);
      fender.position.set(0, 1.42, z);
      root.add(fender);
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
    const once = request as unknown as { __applied?: boolean };
    if (once.__applied) return;
    once.__applied = true;
    fixDecals(source);
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
    const recolorStripes = (texture: THREE.Texture | null): THREE.Texture | null => {
      if (!texture || !texture.image) return texture;
      try {
        const image = texture.image as HTMLImageElement | ImageBitmap;
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return texture;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];
          // coral do modelo original -> verde getTMS (por matiz, pega variações)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          let hue = 0;
          if (max !== min) {
            if (max === r) hue = ((g - b) / (max - min)) % 6;
            else if (max === g) hue = (b - r) / (max - min) + 2;
            else hue = (r - g) / (max - min) + 4;
            hue *= 60;
            if (hue < 0) hue += 360;
          }
          if (sat > 0.22 && hue >= 2 && hue <= 34) {
            px[i] = 0x63;
            px[i + 1] = 0xb3;
            px[i + 2] = 0x2e;
          }
        }
        ctx.putImageData(data, 0, 0);
        const out = new THREE.CanvasTexture(canvas);
        out.colorSpace = texture.colorSpace;
        out.flipY = texture.flipY;
        out.wrapS = texture.wrapS;
        out.wrapT = texture.wrapT;
        out.anisotropy = texture.anisotropy;
        out.needsUpdate = true;
        return out;
      } catch {
        return texture;
      }
    };
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      const stripeMesh = request.livery && /stripe|coral|accent|faixa/i.test(mesh.name);
      const tint = (material: THREE.Material) => {
        const std = material.clone() as THREE.MeshStandardMaterial;
        if (request.livery && !std.map && std.color) {
          const hsl = { h: 0, s: 0, l: 0 };
          std.color.getHSL(hsl);
          const hue = hsl.h * 360;
          if (hsl.s > 0.25 && hue >= 2 && hue <= 34) {
            std.color.set(0x63b32e);
            std.needsUpdate = true;
            return std;
          }
        }
        if (stripeMesh) {
          std.map = null;
          std.color.set(0x63b32e);
          std.metalness = 0.2;
          std.roughness = 0.45;
          std.needsUpdate = true;
          return std;
        }
        const matName = (material.name || "").toLowerCase();
        if (request.livery && std.map) std.map = recolorStripes(std.map);
        if (request.livery && std.color) {
          // pintura getTMS: carroceria branca, faixa verde e vidro escuro
          if (matName.includes("stripe") || matName.includes("coral")) {
            if (std.map) std.map = recolorStripes(std.map);
            std.color.set(0x63b32e);
            std.metalness = 0.2;
            std.roughness = 0.45;
            std.needsUpdate = true;
            return std;
          }
          if (matName.includes("glass") || matName.includes("window")) {
            std.color.set(0x1f2b26);
            std.metalness = 0.9;
            std.roughness = 0.08;
            std.needsUpdate = true;
            return std;
          }
          if (matName.includes("tire") || matName.includes("rim")) {
            std.needsUpdate = true;
            return std;
          }
          if (matName.includes("paint")) {
            // cabine branca getTMS, mantendo o relevo e o brilho da pintura
            std.map = null;
            std.color.set(0xf7f9f3);
            std.metalness = Math.min(std.metalness ?? 0.2, 0.3);
            std.roughness = 0.3;
            std.needsUpdate = true;
            return std;
          }
          if (matName.includes("body")) {
            // trator (capô, cabine) branco getTMS
            std.map = null;
            std.color.set(0xf7f9f3);
            std.metalness = Math.min(std.metalness ?? 0.2, 0.3);
            std.roughness = 0.32;
            std.needsUpdate = true;
            return std;
          }
          if (matName.includes("trailer")) {
            // carreta: mantém sulcos e detalhes, só troca o coral pelo verde getTMS
            std.map = recolorStripes(std.map);
            std.color.set(0xffffff);
            std.needsUpdate = true;
            return std;
          }
          if (matName.includes("trim")) {
            if (std.map) std.map = recolorStripes(std.map);
            std.needsUpdate = true;
            return std;
          }
        }
        if (request.livery && std.map) std.map = recolorStripes(std.map);
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
    // rodas: substitui as do modelo por pneus na escala certa e assenta no chão
    clone.updateMatrixWorld(true);
    const wheelMeshes: THREE.Mesh[] = [];
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const name = child.name.toLowerCase();
      const parentName = child.parent?.name.toLowerCase() ?? "";
      if (mesh.isMesh && (name.includes("wheel") || name.includes("tire") || parentName.includes("wheel"))) {
        wheelMeshes.push(mesh);
      }
    });
    if (!wheelMeshes.length && !request.keepWheels) {
      // modelo sem rodas nomeadas: garante rodas para o veículo não aparecer "sumido"
      const wheelR = (request.length / 17) * 0.5;
      const wheelW = (request.length / 17) * 0.4;
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.88 });
      const tireGeo = cachedGeo(`tire:${wheelR.toFixed(2)}:${wheelW.toFixed(2)}`, () => new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 22));
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      const alongZ = size.z >= size.x;
      const length = alongZ ? size.z : size.x;
      const lateral = alongZ ? size.x : size.z;
      [-0.34, 0.32].forEach((frac) => {
        [-1, 1].forEach((side) => {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          if (alongZ) tire.rotation.z = Math.PI / 2;
          else tire.rotation.x = Math.PI / 2;
          tire.position.set(
            alongZ ? side * (lateral / 2 - wheelW * 0.5) : frac * length,
            wheelR + 0.02,
            alongZ ? frac * length : side * (lateral / 2 - wheelW * 0.5),
          );
          wrapper.add(tire);
        });
      });
    }
    if (wheelMeshes.length && !request.keepWheels) {
      const wheelR = (request.length / 17) * 0.53;
      const wheelW = (request.length / 17) * 0.42;
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.88 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x8d968d, roughness: 0.4, metalness: 0.6 });
      const tireGeo = cachedGeo(`tire:${wheelR.toFixed(2)}:${wheelW.toFixed(2)}`, () => new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 22));
      const rimGeo = new THREE.CylinderGeometry(wheelR * 0.62, wheelR * 0.62, wheelW * 0.55, 18);
      // eixos a partir da posição da cabine (vidros), com bitola fixa
      const cloneBox = new THREE.Box3().setFromObject(clone);
      const cloneSize = cloneBox.getSize(new THREE.Vector3());
      const cloneCenter = cloneBox.getCenter(new THREE.Vector3());
      const travelIsZ = cloneSize.z >= cloneSize.x;
      const length = travelIsZ ? cloneSize.z : cloneSize.x;
      const track = (request.length / 17) * 1.28;
      let cabObject: THREE.Object3D | null = null;
      clone.traverse((child) => {
        const name = child.name.toLowerCase();
        if (!cabObject && (child as THREE.Mesh).isMesh && (name.includes("window") || name.includes("glass") || name.includes("cab"))) {
          cabObject = child;
        }
      });
      const cabBox = cabObject ? new THREE.Box3().setFromObject(cabObject) : cloneBox.clone();
      const cabAlong = travelIsZ ? cabBox.getCenter(new THREE.Vector3()).z : cabBox.getCenter(new THREE.Vector3()).x;
      const centerAlong = travelIsZ ? cloneCenter.z : cloneCenter.x;
      const dir = cabAlong >= centerAlong ? 1 : -1;
      const farEnd = centerAlong - (dir * length) / 2;
      const axleAlong = [
        cabAlong - dir * length * 0.09,
        cabAlong - dir * length * 0.2,
        cabAlong - dir * length * 0.28,
        farEnd + dir * length * 0.16,
        farEnd + dir * length * 0.25,
      ];
      wheelMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
      const lateralCenter = travelIsZ ? cloneCenter.x : cloneCenter.z;
      axleAlong.forEach((along) => {
        [-1, 1].forEach((side) => {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          const rim = new THREE.Mesh(rimGeo, rimMat);
          [tire, rim].forEach((part) => {
            if (travelIsZ) part.rotation.z = Math.PI / 2;
            else part.rotation.x = Math.PI / 2;
            part.position.set(
              travelIsZ ? lateralCenter + side * track : along,
              wheelR + 0.02,
              travelIsZ ? along : lateralCenter + side * track,
            );
            wrapper.add(part);
          });
        });
      });
    }
    wrapper.add(clone);
    if (request.label) {
      const plateCanvas = document.createElement("canvas");
      plateCanvas.width = 1024;
      plateCanvas.height = 256;
      const plateCtx = plateCanvas.getContext("2d")!;
      plateCtx.clearRect(0, 0, 1024, 256);
      plateCtx.textBaseline = "middle";
      // bloco centralizado: pino + wordmark
      const wordFont = "500 96px Sora, Inter, sans-serif";
      const boldFont = "800 96px Sora, Inter, sans-serif";
      plateCtx.font = wordFont;
      const getW = plateCtx.measureText("get").width;
      plateCtx.font = boldFont;
      const tmsW = plateCtx.measureText("TMS").width;
      const pinW = 66;
      const gapPin = 30;
      const gapWord = 6;
      const blockW = pinW + gapPin + getW + gapWord + tmsW;
      const startX = (1024 - blockW) / 2;
      const midY = 118;
      const pinH = 112;
      const pinY = midY - pinH / 2;
      const pinX = startX;
      plateCtx.beginPath();
      plateCtx.moveTo(pinX + pinW / 2, pinY + pinH);
      plateCtx.bezierCurveTo(pinX + pinW * 0.14, pinY + pinH * 0.62, pinX, pinY + pinH * 0.44, pinX, pinY + pinH * 0.29);
      plateCtx.arc(pinX + pinW / 2, pinY + pinH * 0.29, pinW / 2, Math.PI, 0, false);
      plateCtx.bezierCurveTo(pinX + pinW, pinY + pinH * 0.44, pinX + pinW * 0.86, pinY + pinH * 0.62, pinX + pinW / 2, pinY + pinH);
      plateCtx.closePath();
      plateCtx.fillStyle = "#63b32e";
      plateCtx.fill();
      plateCtx.strokeStyle = "#ffffff";
      plateCtx.lineWidth = 9;
      plateCtx.lineCap = "round";
      plateCtx.lineJoin = "round";
      plateCtx.beginPath();
      plateCtx.moveTo(pinX + 19, pinY + 48);
      plateCtx.lineTo(pinX + 30, pinY + 61);
      plateCtx.lineTo(pinX + 49, pinY + 37);
      plateCtx.stroke();
      const textX = pinX + pinW + gapPin;
      plateCtx.fillStyle = "#4d4d4d";
      plateCtx.font = wordFont;
      plateCtx.fillText("get", textX, midY);
      plateCtx.fillStyle = "#63b32e";
      plateCtx.font = boldFont;
      plateCtx.fillText("TMS", textX + getW + gapWord, midY);
      // filete fino sob a assinatura
      plateCtx.fillStyle = "#63b32e";
      plateCtx.fillRect(textX, midY + 58, getW + gapWord + tmsW, 6);
      // assinatura discreta
      plateCtx.fillStyle = "#7d8a80";
      plateCtx.font = "600 30px Inter, sans-serif";
      plateCtx.textAlign = "center";
      plateCtx.fillText("LOGÍSTICA SOB CONTROLE", 512, 214);
      plateCtx.textAlign = "right";
      plateCtx.fillStyle = "#9aa59c";
      plateCtx.font = "700 26px Inter, sans-serif";
      plateCtx.fillText(request.label, 996, 40);
      plateCtx.textAlign = "left";
      const plateTex = track(new THREE.CanvasTexture(plateCanvas));
      plateTex.colorSpace = THREE.SRGBColorSpace;
      const plateMat = new THREE.MeshBasicMaterial({
        map: plateTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      let trailerMesh: THREE.Object3D | null = null;
      if (request.livery) {
        clone.traverse((o) => {
          if (!trailerMesh && /trailer|ba[uú]|box/i.test(o.name)) trailerMesh = o;
        });
      }
      if (trailerMesh) {
        clone.updateMatrixWorld(true);
        // bbox no espaço local do clone (evita deslocar logo e faixas)
        const inv = new THREE.Matrix4().copy(clone.matrixWorld).invert();
        const tb = new THREE.Box3().setFromObject(trailerMesh).applyMatrix4(inv);
        const tSize = tb.getSize(new THREE.Vector3());
        const tCenter = tb.getCenter(new THREE.Vector3());
        const lengthAlongX = tSize.x >= tSize.z;
        const trailerLength = Math.max(tSize.x, tSize.z);
        const plateH = Math.min(tSize.y * 0.44, (trailerLength * 0.34) / 4);
        const plateW = plateH * 4;
        [-1, 1].forEach((side) => {
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateH), plateMat);
          if (lengthAlongX) {
            plate.position.set(tCenter.x, tCenter.y, tCenter.z + side * (tSize.z / 2 + Math.max(0.06, tSize.z * 0.03)));
            plate.rotation.y = side > 0 ? 0 : Math.PI;
          } else {
            plate.position.set(tCenter.x + side * (tSize.x / 2 + Math.max(0.06, tSize.x * 0.03)), tCenter.y, tCenter.z);
            plate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          clone.add(plate);
        });
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x63b32e, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide });
        const bandH = Math.max(0.3, Math.min(tSize.y * 0.17, 0.62));
        const bandY = tCenter.y - tSize.y * 0.17;
        [-1, 1].forEach((side) => {
          [bandY, tCenter.y - tSize.y * 0.42].forEach((y, index) => {
            const band = new THREE.Mesh(
              new THREE.PlaneGeometry(trailerLength * (index === 0 ? 0.94 : 0.96), index === 0 ? bandH : 0.14),
              stripeMat,
            );
            if (lengthAlongX) {
              band.position.set(tCenter.x, y, tCenter.z + side * (tSize.z / 2 + Math.max(0.07, tSize.z * 0.035)));
              band.rotation.y = side > 0 ? 0 : Math.PI;
            } else {
              band.position.set(tCenter.x + side * (tSize.x / 2 + Math.max(0.07, tSize.x * 0.035)), y, tCenter.z);
              band.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
            }
            clone.add(band);
          });
        });
      } else {
        [-1, 1].forEach((side) => {
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.85), plateMat);
          plate.position.set(side * 1.32, 2.5, -4.2);
          plate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          clone.add(plate);
        });
      }
    }
    request.holder.add(wrapper);
  }

  const truckRequest = {
    key: "semi-truck",
    holder: truck,
    parts: [...truck.children],
    length: TRUCK_LENGTH,
    rotY: 0,
    wheelScale: 1,
    label: "GT-1024",
    livery: true,
    keepWheels: true,
  };
  proceduralBodies.push({ group: truck, parts: truckRequest.parts });
  queueGlb(truckRequest);
  // sombra no chão que acompanha o caminhão do hero
  const heroShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 22),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  heroShadow.rotation.x = -Math.PI / 2;
  heroShadow.position.set(0, 0.18, -1);
  truck.add(heroShadow);

  glbSources["cab-over"] = makeCabOverSource();
  for (let i = glbRequests.length - 1; i >= 0; i -= 1) {
    if (glbRequests[i].key === "cab-over") {
      applyGlb(glbRequests[i], glbSources["cab-over"]);
      glbRequests.splice(i, 1);
    }
  }
  (window as unknown as { __gettmsSceneRef?: THREE.Scene }).__gettmsSceneRef = scene;
  (window as unknown as { __gettmsVehicles?: () => unknown }).__gettmsVehicles = () => ({
    truck: { x: truck.position.x, z: truck.position.z, len: 12.5 },
    cars: cars.map((car) => ({ x: car.group.position.x, z: car.group.position.z, dir: car.dir, len: 4.3, scale: car.group.scale.x })),
    avenue: avenueTrucks.map((item) => ({ x: item.group.position.x, z: item.group.position.z, dir: item.dir, len: 12.5, scale: item.group.scale.x })),
    highway: highwayTraffic.map((item) => ({ x: item.mesh.position.x, z: item.mesh.position.z, dir: item.dir, len: 12.5 })),
  });
  ["semi-truck", "semi-truck-low", "car-sedan", "car-hatchback", "car-suv", "car-ev", "forklift"].forEach((key, keyIndex) => {
    // escalona o download: o hero e o tráfego primeiro, o resto em seguida sem travar a página
    setTimeout(() => {
    if (disposed) return;
    new GLTFLoader().load(`/models/${key}.glb`, (gltf) => {
      if (disposed) return;
      glbSources[key] = gltf.scene;
      for (let i = glbRequests.length - 1; i >= 0; i -= 1) {
        if (glbRequests[i].key === key) {
          applyGlb(glbRequests[i], gltf.scene);
          glbRequests.splice(i, 1);
        }
      }
    }, (error) => {
      console.warn("[scene] modelo não carregou", key, String(error));
    });
    }, keyIndex * 220);
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
      segmentZoom = Math.min(1.4, Math.max(0.1, z));
    },
    setFeatureScreen(index: number) {
      heroMat.map = heroTextures[Math.max(0, Math.min(3, index))];
      heroMat.needsUpdate = true;
      clientScreenMat.map = heroTextures[Math.max(0, Math.min(3, index))];
      clientScreenMat.needsUpdate = true;
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
    setWeather(mode) {
      weatherMode = mode;
    },
    setActive(active) {
      sceneActive = active;
    },
    snapTruck() {
      truckPhase = heroPhaseFor(current);
      if (truckPhase >= DOCK_START) dockAnim = 1;
    },
    debugCam() {
      return {
        pos: [camera.position.x, camera.position.y, camera.position.z],
        zoom: segmentZoom,
        view: segmentView ? "set" : "null",
        truck: [truck.position.x, truck.position.z],
        phase: truckPhase,
        progress: current,
        weather: `${weatherMode}:${weatherP.toFixed(2)}:${weatherRain.toFixed(2)}`,
      };
    },
    resize,
    scene3d: scene,
    camera3d: camera,
    setOnTruckClick(cb) {
      truckClickRef.cb = cb;
    },
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

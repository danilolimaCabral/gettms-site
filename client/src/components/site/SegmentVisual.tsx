import { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";

type Props = {
  kind: "alimentos" | "farma" | "construcao" | "ecommerce" | "tracking";
};

/**
 * Cena 3D leve para cada segmento (substitui as fotos por geometria real).
 * Renderiza somente quando visível, com um único renderer por card.
 */
export default function SegmentVisual({ kind }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;
    let renderer: import("three").WebGLRenderer | null = null;

    const boot = async () => {
      const THREE = await import("three");
      if (disposed || !host) return;
      const width = host.clientWidth || 560;
      const height = host.clientHeight || 420;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 120);
      camera.position.set(9, 7.4, 11);
      camera.lookAt(0, 1.4, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xd5ddd0, 1.5));
      const key = new THREE.DirectionalLight(0xfff6e6, 2.6);
      key.position.set(6, 12, 7);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xbfe59a, 0.9);
      rim.position.set(-8, 5, -6);
      scene.add(rim);

      const green = new THREE.MeshStandardMaterial({ color: 0x7fd63c, roughness: 0.45, metalness: 0.15 });
      const deep = new THREE.MeshStandardMaterial({ color: 0x2f6f4f, roughness: 0.55 });
      const paper = new THREE.MeshStandardMaterial({ color: 0xf4f7ef, roughness: 0.6 });
      const card = new THREE.MeshStandardMaterial({ color: 0xd9b483, roughness: 0.85 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x1c241e, roughness: 0.6 });

      const stage = new THREE.Group();
      scene.add(stage);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.32, 48), new THREE.MeshStandardMaterial({ color: 0xe9eee2, roughness: 0.95 }));
      base.position.y = -0.16;
      stage.add(base);

      const box = (w: number, h: number, d: number, mat: ThreeTypes.Material, x: number, y: number, z: number) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        stage.add(mesh);
        return mesh;
      };

      if (kind === "alimentos") {
        box(2.6, 1.4, 2.6, card, 0, 0.7, 0);
        box(2.3, 1.2, 2.3, card, 0.1, 2.0, 0.1);
        box(1.9, 1.0, 1.9, green, 0.2, 3.1, 0.2);
        box(0.6, 3.4, 0.6, deep, -3.1, 1.7, -1.4);
        box(0.6, 3.4, 0.6, deep, 3.1, 1.7, -1.4);
        box(6.6, 0.3, 3.4, paper, 0, 3.5, -1.4);
      } else if (kind === "farma") {
        box(3.6, 2.2, 2.4, paper, 0, 1.1, 0);
        box(3.7, 0.5, 2.5, green, 0, 2.45, 0);
        box(1.5, 0.32, 0.12, green, 0, 1.25, 1.24);
        box(0.32, 1.5, 0.12, green, 0, 1.25, 1.24);
        const thermo = box(0.9, 0.9, 0.9, deep, 2.9, 0.45, 1.4);
        thermo.rotation.y = 0.4;
      } else if (kind === "construcao") {
        box(4.4, 0.4, 2.6, card, 0, 0.2, 0);
        for (let row = 0; row < 3; row += 1) {
          for (let col = 0; col < 4; col += 1) {
            box(0.95, 0.42, 1.1, col % 2 === 0 ? paper : card, -1.5 + col * 1.0, 0.6 + row * 0.44, row % 2 === 0 ? -0.4 : 0.3);
          }
        }
        box(0.24, 4.2, 0.24, deep, -3.4, 2.1, -1.8);
        box(0.24, 4.2, 0.24, deep, 3.4, 2.1, -1.8);
        box(7.2, 0.26, 3.6, green, 0, 4.2, -1.8);
      } else if (kind === "tracking") {
        for (let i = 0; i < 14; i += 1) {
          const h = 1 + ((i * 7) % 5) * 0.9;
          box(1.5, h, 1.5, i % 4 === 0 ? green : paper, -5 + (i % 5) * 2.4, h / 2, -4 + Math.floor(i / 5) * 3.2);
        }
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-4.5, 0.4, 2.4),
          new THREE.Vector3(-1.2, 0.4, 1.2),
          new THREE.Vector3(1.4, 0.4, 2.6),
          new THREE.Vector3(3.8, 0.4, 0.4),
        ]);
        const route = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 64, 0.11, 8, false),
          new THREE.MeshBasicMaterial({ color: 0x63b32e }),
        );
        stage.add(route);
        const pin = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 12), new THREE.MeshBasicMaterial({ color: 0x2f6f4f }));
        pin.position.set(3.8, 1.0, 0.4);
        pin.rotation.x = Math.PI;
        stage.add(pin);
      } else {
        box(2.4, 2.4, 2.4, card, -0.6, 1.2, 0);
        box(2.5, 0.28, 0.3, paper, -0.6, 1.9, 0);
        box(2.5, 0.28, 0.3, paper, -0.6, 1.2, 0);
        const phone = box(1.3, 2.6, 0.18, dark, 2.6, 1.4, 0.6);
        phone.rotation.y = -0.5;
        const screen = box(1.15, 2.2, 0.05, green, 2.62, 1.4, 0.7);
        screen.rotation.y = -0.5;
      }

      const clock = new THREE.Clock();
      const render = () => {
        if (disposed || !renderer) return;
        const t = clock.getElapsedTime();
        stage.rotation.y = Math.sin(t * 0.28) * 0.42;
        stage.position.y = Math.sin(t * 0.9) * 0.08;
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
      };

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!frame) frame = requestAnimationFrame(render);
          } else {
            cancelAnimationFrame(frame);
            frame = 0;
          }
        },
        { threshold: 0.05 },
      );
      observer.observe(host);

      const onResize = () => {
        const w = host.clientWidth || width;
        const h = host.clientHeight || height;
        renderer?.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);
      (host as HTMLDivElement & { __cleanup?: () => void }).__cleanup = () => {
        observer.disconnect();
        window.removeEventListener("resize", onResize);
      };
    };

    void boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      const cleanup = (host as HTMLDivElement & { __cleanup?: () => void }).__cleanup;
      cleanup?.();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [kind]);

  return (
    <div
      ref={hostRef}
      className="h-full w-full [background:radial-gradient(120%_100%_at_30%_10%,#f7faf2_0%,#e6ecdf_60%,#dbe3d2_100%)]"
      aria-hidden="true"
    />
  );
}

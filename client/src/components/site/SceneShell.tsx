import { useEffect, useRef, type ReactNode } from "react";

/**
 * Cena de tela cheia: o conteúdo fica preso na viewport enquanto a rolagem
 * avança, e entra/sai com escala, desfoque e opacidade — como o filme do topo.
 */
export default function SceneShell({
  children,
  id,
  height = 170,
  className = "",
  dark = true,
}: {
  children: ReactNode;
  id?: string;
  height?: number;
  className?: string;
  dark?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = host.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
      const enter = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.5)));
      const leave = Math.min(1, Math.max(0, (rect.bottom - vh * 0.15) / (vh * 0.5)));
      const visible = Math.min(enter, leave);
      host.style.setProperty("--scene-enter", visible.toFixed(3));
      host.style.setProperty("--scene-scale", (0.94 + visible * 0.06).toFixed(4));
      host.style.setProperty("--scene-blur", `${((1 - visible) * 6).toFixed(2)}px`);
      host.style.setProperty("--scene-progress", p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section
      id={id}
      ref={hostRef}
      className={`relative ${dark ? "bg-[#0b100c]" : "bg-paper"} ${className}`}
      style={{ height: `${height}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(70%_55%_at_50%_40%,rgba(143,224,74,0.10),transparent_72%)]" />
        <div className="container-wide relative w-full">
          <div
            style={{
              opacity: "var(--scene-enter)",
              transform: "scale(var(--scene-scale))",
              filter: "blur(var(--scene-blur))",
              transition: "opacity 140ms linear",
              willChange: "opacity, transform, filter",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

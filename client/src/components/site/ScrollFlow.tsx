import { useEffect, useRef, type ReactNode } from "react";

/**
 * Faz cada bloco entrar "montando" com a rolagem: leve escala, deslocamento e
 * opacidade ligados à posição do bloco na viewport — o mesmo vocabulário do
 * filme de scroll do topo.
 */
export default function ScrollFlow({
  children,
  id,
  className = "",
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const rect = host.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const passed = vh - rect.top;
      const p = Math.min(1, Math.max(0, passed / total));
      const enter = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.55)));
      const leave = Math.min(1, Math.max(0, rect.bottom / (vh * 0.4)));
      const visible = Math.min(enter, leave);
      host.style.setProperty("--flow-enter", visible.toFixed(3));
      host.style.setProperty("--flow-shift", `${((1 - visible) * 48).toFixed(1)}px`);
      host.style.setProperty("--flow-scale", (0.985 + visible * 0.015).toFixed(4));
      host.style.setProperty("--flow-progress", p.toFixed(3));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      id={id}
      className={`relative [--flow-enter:1] [--flow-shift:0px] [--flow-scale:1] ${className}`}
    >
      <div
        style={{
          opacity: "var(--flow-enter)",
          transform: "translate3d(0, var(--flow-shift), 0) scale(var(--flow-scale))",
          transition: "opacity 120ms linear",
          willChange: "opacity, transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}

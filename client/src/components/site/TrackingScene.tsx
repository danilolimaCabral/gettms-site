import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Radio } from "lucide-react";
import { DEMO_URL, TRACKING_STEPS } from "@/content/site";

const PATH = "M60 250 C 130 250, 150 150, 230 150 S 330 220, 400 190 S 470 90, 540 110";

export default function TrackingScene() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [p, setP] = useState(0);
  const [pos, setPos] = useState({ x: 60, y: 250 });

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const next = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
      setP(next);
      const path = pathRef.current;
      if (path) {
        const point = path.getPointAtLength(path.getTotalLength() * next);
        setPos({ x: point.x, y: point.y });
      }
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

  const activeStep = Math.min(TRACKING_STEPS.length - 1, Math.floor(p * TRACKING_STEPS.length));
  const eta = Math.max(0, Math.round((1 - p) * 214));

  return (
    <section id="tracking" ref={sectionRef} className="relative bg-[#0b100c]" style={{ height: "260vh" }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(70%_55%_at_30%_45%,rgba(143,224,74,0.12),transparent_72%)]" />
        <div className="container-wide relative grid w-full items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#0f1712] p-4">
            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
              <span className="inline-flex items-center gap-2">
                <Radio className="h-3 w-3 text-[#8fe04a]" /> Carga #GT-48219
              </span>
              <span className="text-[#a9ec6a]">{p >= 0.999 ? "entregue" : "em trânsito"}</span>
            </div>
            <svg viewBox="0 0 600 320" className="w-full">
              <defs>
                <pattern id="track-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M30 0H0V30" fill="none" stroke="rgba(255,255,255,0.05)" />
                </pattern>
              </defs>
              <rect width="600" height="320" fill="url(#track-grid)" />
              <path d={PATH} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />
              <path
                ref={pathRef}
                d={PATH}
                fill="none"
                stroke="#8fe04a"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="2000"
                strokeDashoffset={2000 - p * 2000}
              />
              {[
                { x: 60, y: 250, label: "CD origem" },
                { x: 230, y: 150, label: "Transbordo" },
                { x: 400, y: 190, label: "Rota" },
                { x: 540, y: 110, label: "Cliente" },
              ].map((node) => (
                <g key={node.label}>
                  <circle cx={node.x} cy={node.y} r="7" fill="#0b100c" stroke="#8fe04a" strokeWidth="2" />
                  <text x={node.x} y={node.y + 24} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.45)">
                    {node.label}
                  </text>
                </g>
              ))}
              <g transform={`translate(${pos.x - 14}, ${pos.y - 9})`}>
                <rect width="28" height="14" rx="3" fill="#a9ec6a" />
                <rect x="28" y="3" width="8" height="8" rx="2" fill="#f3f6f1" />
              </g>
            </svg>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              {[
                ["Previsão", `${eta} min`],
                ["Temperatura", "4 °C"],
                ["Eventos", `${Math.round(p * 14)}/14`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="block text-[9px] uppercase tracking-[0.16em] text-white/35">{k}</span>
                  <span className="font-display text-sm text-white">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[#8fe04a]">Tracking ao vivo</p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-4xl">
              Cada etapa vira um evento.
            </h2>
            <div className="mt-7 space-y-2">
              {TRACKING_STEPS.map((step, i) => {
                const on = i <= activeStep;
                return (
                  <div
                    key={step.title}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                      on ? "border-[#8fe04a]/50 bg-[#8fe04a]/10" : "border-white/10 bg-white/[0.02] opacity-50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                        on ? "bg-[#8fe04a] text-[#0b100c]" : "border border-white/20 text-white/50"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={`text-sm ${on ? "text-white" : "text-white/60"}`}>{step.title}</span>
                    {i === activeStep && <span className="ml-auto text-[10px] uppercase tracking-[0.16em] text-[#a9ec6a]">agora</span>}
                  </div>
                );
              })}
            </div>
            <a href={DEMO_URL} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#a9ec6a] hover:text-white">
              Ver o tracking ao vivo <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

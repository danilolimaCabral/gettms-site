import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { DEMO_URL, FEATURES } from "@/content/site";

const CARRIERS = [
  { name: "Transportadora A", prazo: "2 dias", valor: "R$ 1.248,00", best: false },
  { name: "Transportadora B", prazo: "3 dias", valor: "R$ 1.096,50", best: true },
  { name: "Transportadora C", prazo: "4 dias", valor: "R$ 1.182,30", best: false },
];

function Screen({ index, progress }: { index: number; progress: number }) {
  const steps = Math.max(0, Math.min(1, (progress - 0.15) / 0.6));
  if (index === 0) {
    return (
      <div className="flex h-full flex-col gap-2 bg-[#0d1410] p-4 text-[11px] text-white/85">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/40">
          <span>Simulação de frete</span>
          <span>SP → Curitiba · 820 km</span>
        </div>
        <div className="rounded-md bg-white/[0.04] px-3 py-2 text-white/60">
          Carga: 12 pallets · 4.800 kg · coleta hoje
        </div>
        {CARRIERS.map((c, i) => {
          const show = steps > i * 0.3;
          const chosen = c.best && steps > 0.85;
          return (
            <div
              key={c.name}
              className={`flex items-center justify-between rounded-md border px-3 py-2 transition-all duration-500 ${
                chosen ? "border-[#8fe04a] bg-[#8fe04a]/12" : "border-white/10 bg-white/[0.02]"
              }`}
              style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(8px)" }}
            >
              <span className="text-white/80">{c.name}</span>
              <span className="text-white/45">{c.prazo}</span>
              <span className="font-semibold text-white">{c.valor}</span>
              {chosen ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8fe04a] text-[#0d1410]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : (
                <span className="h-5 w-5 rounded-full border border-white/20" />
              )}
            </div>
          );
        })}
        <div
          className="mt-auto rounded-md bg-[#8fe04a] px-3 py-2 text-center text-[11px] font-semibold text-[#0d1410] transition-opacity duration-500"
          style={{ opacity: steps > 0.85 ? 1 : 0 }}
        >
          Cotação aprovada · pedido #4821 gerado
        </div>
      </div>
    );
  }
  if (index === 1) {
    const events = ["Coleta realizada", "Em trânsito · Rodovia BR-116", "Atraso previsto · 40 min", "Chegada no CD do cliente"];
    return (
      <div className="flex h-full flex-col gap-2 bg-[#0d1410] p-4 text-[11px] text-white/85">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Ocorrências · pedido #4821</div>
        {events.map((e, i) => (
          <div key={e} className="flex items-center gap-3" style={{ opacity: steps > i * 0.24 ? 1 : 0.15 }}>
            <span className={`h-2 w-2 rounded-full ${i === 2 ? "bg-[#f0b13a]" : "bg-[#8fe04a]"}`} />
            <span className="text-white/75">{e}</span>
            <span className="ml-auto text-white/35">{`${9 + i}:${i % 2 ? "15" : "40"}`}</span>
          </div>
        ))}
        <div className="mt-auto rounded-md border border-[#f0b13a]/40 bg-[#f0b13a]/10 px-3 py-2 text-[#f5d9a1]">
          Ocorrência tratada · cliente notificado
        </div>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="flex h-full flex-col gap-2 bg-[#0d1410] p-4 text-[11px] text-white/85">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Aferição da fatura</div>
        {[["CTe 3321", "R$ 1.096,50"], ["CTe 3322", "R$ 840,00"], ["CTe 3323", "R$ 1.310,20"]].map(([doc, val], i) => (
          <div key={doc} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2" style={{ opacity: steps > i * 0.28 ? 1 : 0.15 }}>
            <span className="text-white/70">{doc}</span>
            <span>{val}</span>
            <span className="text-[#8fe04a]">{steps > i * 0.28 + 0.2 ? "conferido" : "..."}</span>
          </div>
        ))}
        <div className="mt-auto rounded-md bg-[#8fe04a]/15 px-3 py-2 text-[#cdf5a6]">Diferença encontrada: R$ 84,20</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2 bg-[#0d1410] p-4 text-[11px] text-white/85">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Desempenho · últimos 30 dias</div>
      <div className="flex h-28 items-end gap-2">
        {[42, 58, 51, 66, 72, 64, 80].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-[#8fe04a]" style={{ height: `${steps > i * 0.12 ? h : 6}%`, opacity: steps > i * 0.12 ? 1 : 0.2, transition: "height 400ms ease" }} />
        ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <div className="rounded-md border border-white/10 px-3 py-2">Conta frete <b className="text-[#8fe04a]">-11,4%</b></div>
        <div className="rounded-md border border-white/10 px-3 py-2">No prazo <b className="text-[#8fe04a]">96,2%</b></div>
      </div>
    </div>
  );
}

export default function PlatformScenes() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [scene, setScene] = useState(0);
  const [local, setLocal] = useState(0);
  const [lid, setLid] = useState(-88);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
      const n = FEATURES.length;
      const idx = Math.min(n - 1, Math.floor(p * n));
      const loc = Math.min(1, Math.max(0, p * n - idx));
      setScene(idx);
      setLocal(loc);
      const handle = (window as unknown as { __gettmsScene?: { setSegmentZoom: (z: number) => void } }).__gettmsScene;
      handle?.setSegmentZoom(1.05 - loc * 0.35);
      setLid(-90 + Math.min(1, loc / 0.18) * 90);
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

  useEffect(() => {
    const handle = (window as unknown as {
      __gettmsScene?: { setSegmentView: (k: string | null) => void; setFeatureScreen: (i: number) => void };
    }).__gettmsScene;
    const keys = ["simulacao", "ocorrencias", "afericao", "relatorios"];
    handle?.setFeatureScreen(scene);
    handle?.setSegmentView(keys[scene]);
  }, [scene]);

  useEffect(() => () => {
    const handle = (window as unknown as { __gettmsScene?: { setSegmentView: (k: string | null) => void } }).__gettmsScene;
    handle?.setSegmentView(null);
  }, []);

  const feature = FEATURES[scene];

  return (
    <section id="plataforma" ref={sectionRef} className="relative bg-transparent" style={{ height: `${FEATURES.length * 150}vh` }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(11,16,12,0.92)_0%,rgba(11,16,12,0.7)_34%,rgba(11,16,12,0.18)_62%,rgba(11,16,12,0)_100%)]" />
        <div className="container-wide relative grid w-full items-center gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
          <div key={scene} className="order-2 max-w-lg animate-in fade-in-0 slide-in-from-bottom-3 rounded-2xl bg-[#0b100c]/55 p-6 backdrop-blur-sm duration-500 lg:order-1">
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] text-[#8fe04a]">
              {feature.number} · Plataforma
            </p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-4xl">
              {feature.title}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">{feature.body}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {feature.bullets.map((b) => (
                <li key={b} className="rounded-full border border-white/12 px-3 py-1 text-[11px] text-white/55">
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-[#8fe04a] transition-[width] duration-200" style={{ width: `${((scene + local) / FEATURES.length) * 100}%` }} />
              </div>
              <span className="text-[11px] text-white/40">
                {scene + 1} / {FEATURES.length}
              </span>
            </div>
          </div>

          <div className="hidden lg:block" />
        </div>
      </div>
    </section>
  );
}

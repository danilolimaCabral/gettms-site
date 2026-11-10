import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Play, RotateCw } from "lucide-react";
import type { LogisticsSceneHandle } from "@/scene/logisticsScene";
import { WHATSAPP_URL, DEMO_URL } from "@/content/site";

type Chapter = {
  id: string;
  index: string;
  label: string;
  title: string;
  body: string;
  chips: string[];
  start: number;
  end: number;
};

const CHAPTERS: Chapter[] = [
  {
    id: "mapa",
    index: "01",
    label: "O mapa",
    title: "Toda a operação em uma cena.",
    body: "Origens, destinos e volumes conectados.",
    chips: ["Origens", "Destinos", "Volumes"],
    start: 0.08,
    end: 0.18,
  },
  {
    id: "armazem",
    index: "02",
    label: "O armazém",
    title: "Do embarque à doca.",
    body: "Coletas e janelas acompanhadas em tempo real.",
    chips: ["Coletas", "Janelas", "Ocorrências"],
    start: 0.2,
    end: 0.3,
  },
  {
    id: "patio",
    index: "03",
    label: "O pátio",
    title: "Carga organizada, custo sob controle.",
    body: "A mesma plataforma para cada segmento.",
    chips: ["Alimentos", "Farma", "Construção", "E-commerce"],
    start: 0.32,
    end: 0.42,
  },
  {
    id: "cidade",
    index: "04",
    label: "A cidade",
    title: "O prazo que a cidade permite.",
    body: "Rotas urbanas e restrições na simulação.",
    chips: ["Rotas urbanas", "Restrições", "Janelas"],
    start: 0.44,
    end: 0.54,
  },
  {
    id: "rota",
    index: "05",
    label: "A rota",
    title: "Simule antes de fechar.",
    body: "Prazo, valor e modal lado a lado.",
    chips: ["Prazo", "Valor", "Modal"],
    start: 0.56,
    end: 0.66,
  },
  {
    id: "transito",
    index: "06",
    label: "Em trânsito",
    title: "Rastreio sem ponto cego.",
    body: "Status e previsão para o seu cliente.",
    chips: ["Status", "Previsão", "Link do cliente"],
    start: 0.68,
    end: 0.73,
  },
  {
    id: "chegada",
    index: "07",
    label: "A chegada",
    title: "Bem-vindo ao CD do cliente.",
    body: "O caminhão manobra e encosta na doca.",
    chips: ["Docas", "Agendamento"],
    start: 0.74,
    end: 0.82,
  },
  {
    id: "doca",
    index: "08",
    label: "A doca",
    title: "Conferência na hora.",
    body: "Cada volume vira registro no sistema.",
    chips: ["Volume", "Avaria", "Ocorrência"],
    start: 0.835,
    end: 0.9,
  },
  {
    id: "escritorio",
    index: "09",
    label: "O escritório",
    title: "Dado na tela em segundos.",
    body: "Da doca ao dashboard, sem retrabalho.",
    chips: ["Dashboards", "Relatórios"],
    start: 0.915,
    end: 0.96,
  },
  {
    id: "analise",
    index: "10",
    label: "A análise",
    title: "Decisão com o dado do dia.",
    body: "Conta frete, desempenho e redução de custo.",
    chips: ["Conta frete", "Desempenho", "Redução"],
    start: 0.97,
    end: 1.2,
  },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function chapterOpacity(p: number, chapter: Chapter) {
  const fade = 0.022;
  if (p < chapter.start || p > chapter.end) return 0;
  if (p < chapter.start + fade) return (p - chapter.start) / fade;
  if (p > chapter.end - fade) return Math.max(0, (chapter.end - p) / fade);
  return 1;
}

export default function ScrollStage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const vhRef = useRef<number>(typeof window !== "undefined" ? window.innerHeight : 800);
  const [progress, setProgress] = useState(0);
  const [orbit, setOrbit] = useState(false);
  const progressRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const railFillRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const sceneRef = useRef<LogisticsSceneHandle | null>(null);
  const activeRef = useRef(-1);

  useEffect(() => {
    const onSeek = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail !== "number") return;
      const section = sectionRef.current;
      if (!section) return;
      const travel = section.offsetHeight - window.innerHeight;
      window.scrollTo({ top: section.offsetTop + travel * detail, behavior: "smooth" });
    };
    window.addEventListener("gettms:seek", onSeek);
    return () => window.removeEventListener("gettms:seek", onSeek);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const low = window.matchMedia("(max-width: 900px)").matches;
    let scene: LogisticsSceneHandle | null = null;
    let cancelled = false;

    // three.js é carregado sob demanda para não pesar na primeira pintura
    import("@/scene/logisticsScene")
      .then(({ createLogisticsScene }) => {
        if (cancelled) return;
        scene = createLogisticsScene(canvas, { quality: low ? "low" : "high" });
        sceneRef.current = scene;
        (window as unknown as { __gettmsScene?: LogisticsSceneHandle }).__gettmsScene = scene;
      })
      .catch((error) => {
        console.warn("[scene] WebGL indisponível, mantendo fundo estático.", error);
      });

    const onResize = () => scene?.resize();
    window.addEventListener("resize", onResize);

    const onPointer = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      scene?.setPointer(x, y);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    let vhTimer = 0;
    const onViewport = () => {
      window.clearTimeout(vhTimer);
      vhTimer = window.setTimeout(() => {
        vhRef.current = window.innerHeight;
        update();
      }, 200);
    };
    window.addEventListener("resize", onViewport);

    let raf = 0;
    const update = () => {
      const section = sectionRef.current;
      if (section) {
        const rect = section.getBoundingClientRect();
        const travel = rect.height - vhRef.current;
        const p = travel > 0 ? clamp01(-rect.top / travel) : 0;
        scene?.setProgress(p);
        if (Math.abs(p - progressRef.current) > 0.008) {
          progressRef.current = p;
          setProgress(p);
        }

        // hero
        if (heroRef.current) {
          const heroOut = clamp01(p / 0.09);
          heroRef.current.style.opacity = String(1 - heroOut);
          heroRef.current.style.transform = `translate3d(0, ${-heroOut * 40}px, 0)`;
          heroRef.current.style.pointerEvents = heroOut > 0.5 ? "none" : "auto";
        }

        // capítulos
        let currentChapter = -1;
        CHAPTERS.forEach((chapter, i) => {
          const node = chapterRefs.current[i];
          if (!node) return;
          const o = chapterOpacity(p, chapter);
          node.style.opacity = String(o);
          node.style.transform = `translate3d(0, ${(1 - o) * 26}px, 0)`;
          node.style.pointerEvents = o > 0.6 ? "auto" : "none";
          if (o > 0.5) currentChapter = i;
        });

        if (currentChapter !== activeRef.current) {
          activeRef.current = currentChapter;
          setActive(currentChapter);
        }

        if (railFillRef.current) railFillRef.current.style.transform = `scaleY(${p})`;
        if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - p / 0.05));
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("pointermove", onPointer);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const jumpTo = (p: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.offsetTop;
    const travel = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * p, behavior: "smooth" });
  };

  return (
    <section id="experiencia" ref={sectionRef} className="relative h-[1400svh]" aria-label="A jornada da carga no GetTMS">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full" />

        {/* atmosfera / vinheta */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(245,247,242,0)_0%,rgba(245,247,242,0.05)_62%,rgba(245,247,242,0.35)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-paper/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(10,15,11,0.05)_1px,transparent_1px)] [background-size:100%_4px]" />

        {/* HUD superior */}
        <div className="pointer-events-none absolute inset-x-0 top-24 flex items-center justify-between px-6 md:px-12">
          <div className="hidden text-[10px] uppercase tracking-[0.28em] text-ink/35 md:block">
            Role para montar a cena
          </div>
        </div>

        {/* hero */}
        <div
          ref={heroRef}
          className="absolute inset-0 flex items-end pb-24 pt-28 md:items-center md:pb-0 md:pt-24"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper via-paper/85 to-transparent md:bg-gradient-to-r md:from-paper md:via-paper/70 md:to-transparent" />
          <div className="container-wide relative">
            <div className="max-w-3xl">
              <p className="eyebrow mb-6 flex items-center gap-3">
                <span className="h-px w-10 bg-brand/70" />
                Plataforma TMS · Gestão de transportes
              </p>
              <h1 className="display-xl text-ink">
                Menos custo.
                <br />
                <span className="text-gradient">Mais controle</span>
                <br />
                em cada frete.
              </h1>
              <p className="lede mt-7 max-w-md">
                Simule fretes, acompanhe cada etapa e reduza a conta frete.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href={DEMO_URL} target="_blank" rel="noreferrer" className="btn btn-primary">
                  Agendar demonstração
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <button type="button" onClick={() => jumpTo(0.34)} className="btn btn-ghost">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Ver a plataforma
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !orbit;
                    setOrbit(next);
                    sceneRef.current?.setOrbit(next);
                  }}
                  onPointerDown={(event) => {
                    if (!orbit) return;
                    const startX = event.clientX;
                    const move = (e: PointerEvent) => sceneRef.current?.orbitBy((e.clientX - startX) * 0.004);
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", () => window.removeEventListener("pointermove", move), { once: true });
                    window.addEventListener("wheel", (e) => sceneRef.current?.orbitZoom(e.deltaY * 0.05), { passive: true });
                  }}
                  className={`btn btn-ghost ${orbit ? "!border-brand !text-brand-dark" : ""}`}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  {orbit ? "360° · arraste" : "Ver em 360°"}
                </button>
              </div>
              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-ink/45">
                <span>Simulação de frete</span>
                <span className="h-1 w-1 rounded-full bg-ink/20" />
                <span>Tracking em tempo real</span>
                <span className="h-1 w-1 rounded-full bg-ink/20" />
                <span>Redução da conta frete</span>
              </div>
            </div>
          </div>
        </div>

        {/* capítulos */}
        {CHAPTERS.map((chapter, i) => (
          <div
            key={chapter.id}
            ref={(node) => {
              chapterRefs.current[i] = node;
            }}
            className="pointer-events-none absolute inset-x-0 bottom-24 opacity-0 md:bottom-28"
            style={{ willChange: "opacity, transform" }}
          >
            <div className="container-wide">
              <div className="max-w-md rounded-2xl border border-white/10 bg-white/90 p-5 shadow-[0_24px_60px_-40px_rgba(10,15,11,0.5)] backdrop-blur-sm md:p-6">
                <div className="mb-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-brand-dark">
                  <span className="font-display">{chapter.index}</span>
                  <span className="h-px w-8 bg-brand/50" />
                  <span className="text-ink/50">{chapter.label}</span>
                </div>
                <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">{chapter.title}</h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {chapter.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-brand/25 bg-brand-soft px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-brand-dark"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* mapa da operação */}
        <div className="absolute right-6 top-24 hidden w-60 rounded-2xl border border-ink/10 bg-white/85 p-3 backdrop-blur-md lg:block">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.28em] text-ink/40">Mapa da operação</p>
            <span className="text-[9px] font-medium text-brand-dark">
              {CHAPTERS[Math.max(0, active >= 0 ? active : CHAPTERS.findIndex((c) => progress >= c.start && progress <= c.end))]?.label ?? "Operação"}
            </span>
          </div>
          <svg viewBox="0 0 210 96" className="w-full" role="img" aria-label="Mapa das etapas da operação">
            <polyline
              points="16,76 38,58 60,66 82,44 104,52 126,34 148,42 170,26 188,34 198,16"
              fill="none"
              stroke="rgba(10,15,11,0.16)"
              strokeWidth="1.4"
              strokeDasharray="3 3"
            />
            <polyline
              points="16,76 38,58 60,66 82,44 104,52 126,34 148,42 170,26 188,34 198,16"
              fill="none"
              stroke="#63b32e"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - Math.min(1, Math.max(0, progress))}
            />
            {[
              [16, 76],
              [38, 58],
              [60, 66],
              [82, 44],
              [104, 52],
              [126, 34],
              [148, 42],
              [170, 26],
              [188, 34],
              [198, 16],
            ].map(([x, y], index) => {
              const chapter = CHAPTERS[index];
              const isActive = active === index;
              return (
                <g
                  key={`${x}-${y}`}
                  onClick={() => jumpTo((chapter.start + chapter.end) / 2)}
                  className="cursor-pointer"
                  role="button"
                  aria-label={chapter.label}
                >
                  <title>{`${chapter.index} · ${chapter.label}`}</title>
                  <circle cx={x} cy={y} r="9" fill="transparent" />
                  {isActive && <circle cx={x} cy={y} r="7.5" fill="rgba(99,179,46,0.22)" />}
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 4.2 : 2.8}
                    fill={isActive ? "#63b32e" : "#0a0f0b"}
                    opacity={isActive ? 1 : 0.35}
                  />
                </g>
              );
            })}
          </svg>
          <p className="mt-1 text-center text-[9px] text-ink/35">Clique em um ponto para ir à cena</p>
        </div>

        {/* trilho de progresso */}
        <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-4 md:flex">
          <div className="relative h-40 w-px bg-ink/15">
            <div ref={railFillRef} className="absolute inset-0 origin-top bg-brand" style={{ transform: "scaleY(0)" }} />
          </div>
          <div className="flex flex-col gap-3">
            {CHAPTERS.map((chapter, i) => (
              <button
                key={chapter.id}
                ref={(node) => {
                  railRefs.current[i] = node;
                }}
                type="button"
                onClick={() => jumpTo((chapter.start + chapter.end) / 2)}
                aria-label={`Ir para ${chapter.label}`}
                className={`group flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  active === i ? "text-brand-dark" : "text-ink/30 hover:text-ink/70"
                }`}
              >
                <span>{chapter.index}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-all ${
                    active === i ? "scale-125 bg-brand" : "bg-ink/20 group-hover:bg-ink/50"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* dica de rolagem */}
        <div
          ref={hintRef}
          className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink/40 md:flex"
        >
          <span>Role</span>
          <ArrowDown className="h-4 w-4 animate-bounce text-brand-dark" />
        </div>
      </div>
    </section>
  );
}

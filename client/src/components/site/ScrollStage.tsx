import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Play } from "lucide-react";
import type { LogisticsSceneHandle } from "@/scene/logisticsScene";
import { WHATSAPP_URL, DEMO_URL } from "@/content/site";

type Chapter = {
  id: string;
  index: string;
  label: string;
  title: string;
  body: string;
  start: number;
  end: number;
};

const CHAPTERS: Chapter[] = [
  {
    id: "mapa",
    index: "01",
    label: "O mapa",
    title: "Sua operação inteira entra em cena.",
    body: "Origens, destinos, transportadoras e volumes conectados em um só lugar — sem planilha paralela, sem telefone tocando para saber onde está a carga.",
    start: 0.08,
    end: 0.18,
  },
  {
    id: "armazem",
    index: "02",
    label: "O armazém",
    title: "Do embarque à doca, tudo registrado.",
    body: "Coletas, agendamentos, janelas e ocorrências acompanhados em tempo real por quem opera — não por quem lembra de ligar depois.",
    start: 0.2,
    end: 0.3,
  },
  {
    id: "patio",
    index: "03",
    label: "O pátio",
    title: "Carga organizada é custo sob controle.",
    body: "Contêineres, paletes e empilhadeira na mesma visão da doca. O volume sai certo, na janela combinada, com histórico de cada movimentação.",
    start: 0.32,
    end: 0.42,
  },
  {
    id: "cidade",
    index: "04",
    label: "A cidade",
    title: "A operação não termina no pátio.",
    body: "Rotas urbanas, viadutos, janelas de entrega e restrições de acesso consideradas na simulação — o prazo prometido é o prazo que a cidade permite cumprir.",
    start: 0.44,
    end: 0.54,
  },
  {
    id: "rota",
    index: "05",
    label: "A rota",
    title: "Cada frete é uma decisão de custo.",
    body: "Simule o frete e compare prazo, valor e modal entre as transportadoras integradas antes de fechar — com a regra comercial da sua operação aplicada.",
    start: 0.56,
    end: 0.66,
  },
  {
    id: "transito",
    index: "06",
    label: "Em trânsito",
    title: "Rastreabilidade sem ponto cego.",
    body: "Cada evento da carga vira histórico: avaria, atraso, desvio, responsável e prazo. O cliente acompanha por um link próprio, sem sobrecarregar o time.",
    start: 0.68,
    end: 0.78,
  },
  {
    id: "chegada",
    index: "07",
    label: "A chegada",
    title: "O caminhão chega ao CD do cliente.",
    body: "Docas, janelas de recebimento e fila de descarga organizadas no mesmo ambiente em que o frete foi simulado — sem retrabalho de planilha na portaria.",
    start: 0.74,
    end: 0.82,
  },
  {
    id: "doca",
    index: "08",
    label: "A doca",
    title: "Recebimento conferido na hora.",
    body: "Cada caminhão é identificado, o volume é conferido e a ocorrência — falta, avaria ou sobra — é registrada no celular do conferente, não no papel.",
    start: 0.835,
    end: 0.9,
  },
  {
    id: "escritorio",
    index: "09",
    label: "O escritório",
    title: "A informação sobe para o escritório.",
    body: "O que aconteceu na doca vira dado no painel em segundos: prazo, custo, transportadora e status da carga na mesma tela da análise.",
    start: 0.915,
    end: 0.96,
  },
  {
    id: "analise",
    index: "10",
    label: "A análise",
    title: "Decisão com o dado do dia.",
    body: "Relatórios de desempenho, aferição de faturas e redução da conta frete comprovada em números — não em sensação.",
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

    let raf = 0;
    const update = () => {
      const section = sectionRef.current;
      if (section) {
        const rect = section.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        const p = travel > 0 ? clamp01(-rect.top / travel) : 0;
        scene?.setProgress(p);

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
    <section id="experiencia" ref={sectionRef} className="relative h-[920vh]" aria-label="A jornada da carga no GetTMS">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* atmosfera / vinheta */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(245,247,242,0)_0%,rgba(245,247,242,0.45)_58%,rgba(245,247,242,0.96)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-paper via-paper/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-paper via-paper/75 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(10,15,11,0.05)_1px,transparent_1px)] [background-size:100%_4px]" />

        {/* HUD superior */}
        <div className="pointer-events-none absolute inset-x-0 top-24 flex items-center justify-between px-6 md:px-12">
          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.28em] text-ink/45">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Operação em tempo real
          </div>
          <div className="hidden text-[10px] uppercase tracking-[0.28em] text-ink/35 md:block">
            Role para montar a cena
          </div>
        </div>

        {/* hero */}
        <div
          ref={heroRef}
          className="absolute inset-0 flex items-end pb-24 md:items-center md:pb-0"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper via-paper/85 to-transparent md:bg-gradient-to-r md:from-paper md:via-paper/80 md:to-transparent" />
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
              <p className="lede mt-7 max-w-xl">
                Simule fretes, integre transportadoras e acompanhe cada etapa da carga — do pedido à entrega —
                em uma operação conectada e guiada por dados reais.
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
              <div className="max-w-xl rounded-2xl border border-ink/10 bg-white/85 p-6 shadow-[0_30px_80px_-50px_rgba(10,15,11,0.6)] backdrop-blur-md md:p-8">
                <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-brand-dark">
                  <span className="font-display">{chapter.index}</span>
                  <span className="h-px w-8 bg-brand/50" />
                  <span className="text-ink/50">{chapter.label}</span>
                </div>
                <h2 className="display-md text-ink">{chapter.title}</h2>
                <p className="mt-4 text-sm leading-relaxed text-ink/60 md:text-base">{chapter.body}</p>
              </div>
            </div>
          </div>
        ))}

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

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, CloudRain, Moon, Play, RotateCw, Sparkles, Sun, Volume2, VolumeX } from "lucide-react";
import type { LogisticsSceneHandle } from "@/scene/logisticsScene";
import StockPanel from "@/components/site/StockPanel";
import CustomerTrackPanel from "@/components/site/CustomerTrackPanel";
import TruckTrackPanel from "@/components/site/TruckTrackPanel";
import type { TruckInfo } from "@/scene/logisticsScene";
import { Ambience, type AmbienceMode } from "@/audio/ambience";
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
  split?: boolean;
};

type WeatherMode = "auto" | "day" | "night" | "rain";
const WEATHERS: { id: WeatherMode; label: string; icon: typeof Sun }[] = [
  { id: "auto", label: "Auto", icon: Sparkles },
  { id: "day", label: "Dia", icon: Sun },
  { id: "night", label: "Noite", icon: Moon },
  { id: "rain", label: "Chuva", icon: CloudRain },
];
const GIANT_WORDS = [
  { word: "LOGÍSTICA", at: 0.02 },
  { word: "CONTROLE", at: 0.24 },
  { word: "PÁTIO", at: 0.4 },
  { word: "AVENIDA", at: 0.47 },
  { word: "ESTRADA", at: 0.56 },
  { word: "EXPRESSA", at: 0.64 },
  { word: "PERIFERIA", at: 0.72 },
  { word: "CLIENTE", at: 0.81 },
  { word: "DOCA", at: 0.89 },
  { word: "DADOS", at: 0.96 },
];

const CHAPTERS: Chapter[] = [
  {
    id: "pedido",
    index: "01",
    label: "O pedido",
    title: "O cliente monta o pedido.",
    body: "Volumes, endereço e janela de entrega direto no portal.",
    chips: ["Pedido", "Volumes", "Janela"],
    start: 0.08,
    end: 0.18,
  },
  {
    id: "simulacao",
    index: "02",
    label: "Simulação GetLOG",
    title: "Frete comparado antes de fechar.",
    body: "Prazo, valor e modalidade entre as transportadoras integradas.",
    chips: ["Prazo", "Valor", "Modalidade"],
    start: 0.2,
    end: 0.3,
  },
  {
    id: "separacao",
    index: "03",
    label: "Separação no CD",
    title: "Cada volume separado e conferido.",
    body: "O pedido vira carga: separação, conferência e carregamento.",
    chips: ["Picking", "Conferência", "Carregamento"],
    start: 0.32,
    end: 0.42,
  },
  {
    id: "saida",
    index: "04",
    label: "Saindo do CD",
    title: "O caminhão deixa o centro de distribuição.",
    body: "A carga sai da doca e cruza a avenida semáforo a semáforo.",
    chips: ["Avenida", "Semáforos", "Janelas"],
    start: 0.44,
    end: 0.52,
  },
  {
    id: "estrada",
    index: "05",
    label: "Na estrada",
    title: "Da avenida para a estrada.",
    body: "Trevo, saída e trecho rural até a via expressa.",
    chips: ["Trevo", "Estrada", "Trecho rural"],
    start: 0.545,
    end: 0.605,
  },
  {
    id: "expressa",
    index: "06",
    label: "Via expressa",
    title: "Estrada longa, rastreio sem ponto cego.",
    body: "Status e previsão atualizados a cada trecho percorrido.",
    chips: ["Via expressa", "Status", "Previsão"],
    start: 0.625,
    end: 0.685,
  },
  {
    id: "acompanhamento",
    index: "07",
    label: "Cliente acompanhando",
    title: "O cliente vê onde está o pedido.",
    body: "Acompanhamento em tempo real, do trânsito até a portaria.",
    chips: ["Acompanhamento", "Previsão", "Motorista"],
    start: 0.705,
    end: 0.765,
  },
  {
    id: "chegada",
    index: "08",
    label: "Chegando",
    title: "Bem-vindo ao Cliente Horizonte.",
    body: "O caminhão entra no pátio e encosta na doca.",
    chips: ["Portaria", "Docas", "Agendamento"],
    start: 0.785,
    end: 0.85,
  },
  {
    id: "doca",
    split: true,
    index: "09",
    label: "A doca",
    title: "Ré na doca e conferência na hora.",
    body: "Porta aberta, volumes descarregados e registro no sistema.",
    chips: ["Volume", "Avaria", "Ocorrência"],
    start: 0.865,
    end: 0.915,
  },
  {
    id: "analise",
    index: "10",
    label: "A análise",
    title: "Decisão com o dado do dia.",
    body: "Conta frete, desempenho e redução de custo.",
    chips: ["Conta frete", "Desempenho", "Redução"],
    start: 0.93,
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
  const lastUserRef = useRef(0);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const railFillRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const sceneRef = useRef<LogisticsSceneHandle | null>(null);
  const activeRef = useRef(-1);
  const [auto, setAuto] = useState(true);
  const autoRef = useRef(true);
  const [weather, setWeather] = useState<WeatherMode>("auto");
  const [truckInfo, setTruckInfo] = useState<TruckInfo | null>(null);
  const [sound, setSound] = useState(false);
  const ambienceRef = useRef<Ambience | null>(null);
  const soundProgressRef = useRef(0);

  // som ambiente acompanha o clima (e, no automático, o trecho do filme)
  useEffect(() => {
    soundProgressRef.current = progress;
    const ambience = ambienceRef.current;
    if (!ambience || !ambience.running) return;
    let mode: AmbienceMode;
    if (weather === "day") mode = "day";
    else if (weather === "night") mode = "night";
    else if (weather === "rain") mode = "rain";
    else mode = progress > 0.8 ? "night" : progress > 0.56 ? "rain" : "day";
    ambience.setMode(mode);
  }, [weather, progress]);

  useEffect(() => () => ambienceRef.current?.dispose(), []);

  const toggleSound = () => {
    if (!ambienceRef.current) ambienceRef.current = new Ambience();
    const ambience = ambienceRef.current;
    if (sound) {
      ambience.disable();
      setSound(false);
      return;
    }
    void ambience.enable().then(() => {
      const p = soundProgressRef.current;
      ambience.setMode(weather === "day" ? "day" : weather === "night" ? "night" : weather === "rain" ? "rain" : p > 0.8 ? "night" : p > 0.56 ? "rain" : "day");
    });
    setSound(true);
  };
  const weatherRef = useRef<WeatherMode>("auto");
  const stageRef = useRef<HTMLElement | null>(null);
  const viewObserverRef = useRef<IntersectionObserver | null>(null);
  const [canvasVisible, setCanvasVisible] = useState(true);

  useEffect(() => {
    autoRef.current = auto;
    weatherRef.current = weather;
    sceneRef.current?.setWeather(weather);
  }, [auto, weather]);

  useEffect(() => {
    const onSeek = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail !== "number") return;
      const section = sectionRef.current;
      if (!section) return;
      const travel = section.offsetHeight - window.innerHeight;
      lastUserRef.current = performance.now();
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
        scene.setWeather(weatherRef.current);
        scene.setOnTruckClick?.((info) => setTruckInfo(info));
        sceneRef.current = scene;
        if (sectionRef.current) {
          const observer = new IntersectionObserver(
            ([entry]) => {
              sceneRef.current?.setActive(entry.isIntersecting);
              setCanvasVisible(entry.isIntersecting);
            },
            { rootMargin: "150px 0px" },
          );
          observer.observe(sectionRef.current);
          viewObserverRef.current = observer;
        }
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

    // o filme anda sozinho; qualquer gesto do usuário pausa a reprodução por alguns segundos
    const markUser = () => {
      lastUserRef.current = performance.now();
    };
    const userEvents: (keyof WindowEventMap)[] = ["wheel", "touchstart", "keydown", "pointerdown", "mousedown"];
    userEvents.forEach((name) => window.addEventListener(name, markUser, { passive: true }));

    let raf = 0;
    let lastTs = performance.now();
    const update = () => {
      const section = sectionRef.current;
      const now = performance.now();
      const dt = Math.min(250, now - lastTs);
      lastTs = now;
      if (section) {
        const rect = section.getBoundingClientRect();
        const travel = rect.height - vhRef.current;
        const p = travel > 0 ? clamp01(-rect.top / travel) : 0;

        // reprodução automática: o filme roda em ~70s e depois a página segue sozinha
        const inStage = rect.top <= 1 && rect.bottom >= vhRef.current - 1;
        const idle = now - lastUserRef.current > 4000;
        if (autoRef.current && idle && dt > 0) {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (window.scrollY < maxScroll - 2) {
            const speed = inStage ? travel / 70000 : (vhRef.current * 0.24) / 1000;
            window.scrollTo({ top: window.scrollY + Math.max(0.4, speed * dt), behavior: "instant" });
          }
        }
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
      userEvents.forEach((name) => window.removeEventListener(name, markUser));
      scene?.dispose();
      viewObserverRef.current?.disconnect();
      viewObserverRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  const currentIndex = active >= 0 ? active : CHAPTERS.findIndex((c) => progress >= c.start && progress <= c.end);
  const splitChapter = CHAPTERS[currentIndex]?.split ? CHAPTERS[currentIndex] : null;

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
        <canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-0 h-full w-full transition-opacity duration-500"
          style={{ opacity: canvasVisible ? 1 : 0 }}
        />

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

        {/* reprodução automática */}
        <div className="absolute left-6 top-32 z-20 md:left-12">
          <button
            type="button"
            onClick={() => setAuto((value) => !value)}
            aria-pressed={auto}
            className="group flex items-center gap-2 rounded-full border border-ink/10 bg-paper/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink/60 backdrop-blur transition hover:border-brand/50 hover:text-ink"
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${auto ? "bg-brand text-[#0a0f0b]" : "bg-ink/10 text-ink/60"}`}>
              {auto ? (
                <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden="true">
                  <rect x="2" y="1.5" width="2" height="7" fill="currentColor" />
                  <rect x="6" y="1.5" width="2" height="7" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden="true">
                  <path d="M2.5 1.5 L8 5 L2.5 8.5 Z" fill="currentColor" />
                </svg>
              )}
            </span>
            <span className="hidden sm:inline">{auto ? "Reprodução automática" : "Retomar reprodução"}</span>
          </button>
        </div>

        {/* seletor de clima */}
        <div className="absolute left-6 top-[10.5rem] z-20 md:left-12">
          <div className="flex items-center gap-0.5 rounded-full border border-ink/10 bg-paper/80 p-1 backdrop-blur">
            <span className="hidden px-2 text-[9px] font-medium uppercase tracking-[0.22em] text-ink/35 sm:inline">Clima</span>
            {WEATHERS.map(({ id, label, icon: Icon }) => {
              const active = weather === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setWeather(id)}
                  aria-pressed={active}
                  aria-label={`Clima: ${label}`}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] transition ${
                    active ? "bg-brand text-[#0a0f0b]" : "text-ink/55 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
            <span className="mx-1 h-4 w-px bg-ink/10" />
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={sound}
              aria-label={sound ? "Desligar som ambiente" : "Ligar som ambiente"}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] transition ${
                sound ? "bg-brand text-[#0a0f0b]" : "text-ink/55 hover:text-ink"
              }`}
            >
              {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">Som</span>
            </button>
          </div>
        </div>
        {/* letras gigantes ao fundo */}
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          {GIANT_WORDS.map((item, index) => {
            const next = GIANT_WORDS[index + 1]?.at ?? 1.05;
            const span = Math.max(0.08, next - item.at);
            const local = (progress - item.at) / span;
            const visible = local > -0.25 && local < 1.25;
            const opacity = visible ? Math.max(0, 1 - Math.abs(local - 0.45) * 2.1) * 0.5 : 0;
            return (
              <span
                key={item.word}
                aria-hidden="true"
                className="absolute left-0 top-1/2 select-none whitespace-nowrap font-display text-[clamp(5rem,19vw,17rem)] font-semibold leading-none tracking-[-0.05em] text-[#0a0f0b]"
                style={{
                  opacity: opacity * 0.38,
                  transform: `translate3d(${4 + local * -22}vw, -50%, 0)`,
                  filter: "blur(0.6px)",
                  mixBlendMode: "multiply",
                }}
              >
                {item.word}
              </span>
            );
          })}
        </div>
        {/* painel split-screen do capítulo ativo */}
        {splitChapter && (
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[40%] border-r border-ink/10 bg-paper/95 backdrop-blur-[2px] md:flex md:flex-col md:justify-end md:pb-28 md:pl-12 md:pr-10 lg:w-[36%]">
            <div className="max-w-md">
              <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-brand-dark">
                <span className="font-display">{splitChapter.index}</span>
                <span className="h-px w-8 bg-brand/50" />
                <span className="text-ink/50">{splitChapter.label}</span>
              </div>
              <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink lg:text-4xl">
                {splitChapter.title}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/60">{splitChapter.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {splitChapter.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-ink/12 bg-white/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/60"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* hero */}
        <div
          ref={heroRef}
          className="hero-compact absolute inset-0 flex items-end pb-28 pt-24 md:items-center md:pb-0 md:pt-24 [@media(max-height:720px)]:pb-24 [@media(max-height:720px)]:pt-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper via-paper/85 to-transparent md:bg-gradient-to-r md:from-paper md:via-paper/70 md:to-transparent" />
          <div className="container-wide relative">
            <div className="max-w-3xl">
              <p className="eyebrow mb-6 hidden items-center gap-3 md:flex">
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
                Simule fretes, integre transportadoras e reduza custos com uma operação mais inteligente, conectada e baseada em dados reais.
              </p>
              <div className="hero-actions mt-9 grid grid-cols-2 items-center gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
                <a href={DEMO_URL} target="_blank" rel="noreferrer" className="btn btn-primary col-span-2 justify-center sm:col-auto">
                  Agendar demonstração
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <button type="button" onClick={() => jumpTo(0.34)} className="btn btn-ghost col-span-2 justify-center sm:col-auto">
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
                  className={`btn btn-ghost hidden sm:inline-flex ${orbit ? "!border-brand !text-brand-dark" : ""}`}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  {orbit ? "360° · arraste" : "Ver em 360°"}
                </button>
              </div>
              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-ink/45 [@media(max-height:720px)]:hidden">
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
            className={`pointer-events-none absolute inset-x-0 bottom-24 opacity-0 md:bottom-28 ${chapter.split ? "md:hidden" : ""}`}
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

        {/* estoque interno do CD durante o carregamento */}
        <StockPanel active={progress >= 0.86 && progress <= 0.918} progress={progress} />
        <CustomerTrackPanel active={progress >= 0.7 && progress <= 0.785} progress={progress} />
        <TruckTrackPanel info={truckInfo} onClose={() => setTruckInfo(null)} />
        {/* mapa da operação */}
        <div
          className={`absolute right-6 top-24 hidden w-[340px] rounded-3xl border border-ink/10 bg-white/88 p-4 shadow-[0_18px_50px_-30px_rgba(10,15,11,0.45)] backdrop-blur-md transition-opacity duration-500 lg:block xl:w-[400px] ${
            (progress >= 0.7 && progress <= 0.785) || (progress >= 0.86 && progress <= 0.918) ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
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

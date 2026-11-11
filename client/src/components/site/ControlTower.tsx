import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Calculator,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  MapPin,
  Radar,
  Route,
  ScanSearch,
  Truck,
} from "lucide-react";

const PROCESS = [
  { id: "simular", label: "Simular", title: "Simulação de frete", body: "Compare prazo, valor e modalidade entre as transportadoras integradas.", icon: Calculator },
  { id: "emitir", label: "Emitir", title: "Contratação e CT-e", body: "A carga é contratada e o CT-e entra na fila de monitoramento.", icon: ClipboardCheck },
  { id: "monitorar", label: "Monitorar", title: "Tracking em tempo real", body: "Eventos, posição e ETA de cada carga acompanhados na torre.", icon: Radar },
  { id: "ocorrencias", label: "Tratar", title: "Gestão de ocorrências", body: "Atraso, avaria ou desvio viram alerta com responsável e prazo.", icon: AlertTriangle },
  { id: "auditar", label: "Auditar", title: "Auditoria de todos os CT-e", body: "Cada CT-e que chega é conferido contra a tabela e o frete simulado.", icon: ScanSearch },
  { id: "relatorio", label: "Decidir", title: "Relatórios e negociação", body: "Custo, prazo e ocorrência por transportadora viram base de negociação.", icon: FileSpreadsheet },
];

type TabId = "monitoramento" | "tracker" | "simulacao" | "auditoria";
const TABS: { id: TabId; label: string; icon: typeof Radar }[] = [
  { id: "monitoramento", label: "Monitoramento", icon: Radar },
  { id: "tracker", label: "Tracker", icon: MapPin },
  { id: "simulacao", label: "Simulação", icon: Calculator },
  { id: "auditoria", label: "Auditoria de CT-e", icon: ScanSearch },
];

const LIVE = [
  { cte: "CT-e 3321", carrier: "TransSul", route: "São Paulo → Curitiba", status: "Em trânsito", eta: "hoje 16:40", tone: "ok" as const },
  { cte: "CT-e 3322", carrier: "RodoLeste", route: "Curitiba → Joinville", status: "Na doca", eta: "hoje 14:10", tone: "ok" as const },
  { cte: "CT-e 3323", carrier: "ViaNorte", route: "Campinas → Londrina", status: "Ocorrência", eta: "amanhã 09:20", tone: "warn" as const },
  { cte: "CT-e 3324", carrier: "TransSul", route: "São Paulo → Maringá", status: "Em trânsito", eta: "hoje 21:05", tone: "ok" as const },
  { cte: "CT-e 3325", carrier: "Expressa Oeste", route: "Cascavel → Curitiba", status: "Coletado", eta: "amanhã 11:30", tone: "idle" as const },
  { cte: "CT-e 3326", carrier: "RodoLeste", route: "Curitiba → Blumenau", status: "Entregue", eta: "hoje 12:02", tone: "done" as const },
];

const TRACK_EVENTS = [
  { time: "06:12", title: "CT-e autorizado", detail: "Sefaz · chave 4126 0891 3321", done: true },
  { time: "08:40", title: "Coleta no CD São Paulo", detail: "12 volumes · 480 kg", done: true },
  { time: "11:05", title: "Saída da cidade", detail: "Via expressa BR-116 · sem ocorrências", done: true },
  { time: "13:48", title: "Posto de fiscalização", detail: "Passagem registrada automaticamente", done: true },
  { time: "16:40", title: "Previsão de entrega", detail: "Cliente Horizonte · doca 06", done: false },
];

const SIM = [
  { carrier: "TransSul", mode: "Fracionado", days: "2 dias", value: 1096.5, best: false },
  { carrier: "RodoLeste", mode: "Lotação", days: "1 dia", value: 1180.0, best: true },
  { carrier: "ViaNorte", mode: "Fracionado", days: "3 dias", value: 940.2, best: false },
];

type AuditRow = { cte: string; carrier: string; table: number; charged: number; status: "ok" | "div" | "open" };
const AUDIT: AuditRow[] = [
  { cte: "3321", carrier: "TransSul", table: 1096.5, charged: 1096.5, status: "ok" },
  { cte: "3322", carrier: "RodoLeste", table: 840.0, charged: 840.0, status: "ok" },
  { cte: "3323", carrier: "ViaNorte", table: 1226.0, charged: 1310.2, status: "div" },
  { cte: "3324", carrier: "TransSul", table: 762.4, charged: 762.4, status: "ok" },
  { cte: "3325", carrier: "Expressa Oeste", table: 488.9, charged: 488.9, status: "ok" },
  { cte: "3326", carrier: "RodoLeste", table: 655.0, charged: 655.0, status: "ok" },
  { cte: "3327", carrier: "ViaNorte", table: 934.1, charged: 934.1, status: "ok" },
  { cte: "3328", carrier: "TransSul", table: 1210.0, charged: 1210.0, status: "ok" },
  { cte: "3329", carrier: "Expressa Oeste", table: 389.5, charged: 389.5, status: "open" },
];

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-[#8fe04a]/15 text-[#a9ec6a]",
  warn: "bg-[#f0c46b]/15 text-[#f3cf8c]",
  idle: "bg-white/8 text-white/60",
  done: "bg-[#8fe04a] text-[#0b100c]",
  div: "bg-[#ff7a63]/15 text-[#ffab9b]",
  open: "bg-white/8 text-white/55",
};

export default function ControlTower() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [processP, setProcessP] = useState(0);
  const [tab, setTab] = useState<TabId>("monitoramento");

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      setProcessP(Math.min(1, Math.max(0, -rect.top / Math.max(1, total))));
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

  const activeStep = Math.min(PROCESS.length - 1, Math.floor(processP * PROCESS.length + 0.15));
  const auditOk = AUDIT.filter((row) => row.status === "ok").length;
  const auditDiv = AUDIT.filter((row) => row.status === "div");
  const auditDiff = auditDiv.reduce((sum, row) => sum + (row.charged - row.table), 0);

  return (
    <section id="torre" ref={sectionRef} className="relative bg-[#0b100c]" style={{ height: "320vh" }}>
      <div className="sticky top-0 flex h-screen items-start overflow-hidden pt-16 md:items-center md:pt-24">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(65%_55%_at_35%_40%,rgba(143,224,74,0.12),transparent_72%)]" />
        <div className="container-wide relative w-full">
          <div className="mb-4 flex flex-col gap-2 md:mb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#8fe04a]">Torre de controle</p>
              <h2 className="mt-2 max-w-2xl font-display text-xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
                Monitoramento, tracking, simulação e auditoria no mesmo lugar.
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm leading-relaxed text-white/55 md:block">
              A operação inteira passa pela torre: cada frete simulado, cada CT-e emitido e cada carga em trânsito com status, prazo e custo conferidos.
            </p>
          </div>

          {/* processo */}
          <div className="relative mb-6 rounded-2xl border border-white/10 bg-[#0f1712]/80 p-3 md:p-4">
            <div className="pointer-events-none absolute left-6 right-6 top-[38px] hidden h-px bg-white/10 md:block">
              <div className="h-px bg-[#8fe04a] transition-[width] duration-300" style={{ width: `${((activeStep + 1) / PROCESS.length) * 100}%` }} />
            </div>
            <ol className="relative grid grid-cols-3 gap-1.5 md:grid-cols-6 md:gap-1">
              {PROCESS.map((step, index) => {
                const Icon = step.icon;
                const state = index < activeStep ? "done" : index === activeStep ? "active" : "todo";
                return (
                  <li key={step.id} className="relative">
                    <div
                      className={`flex h-full flex-col gap-1.5 rounded-xl px-2.5 py-2 transition-colors md:bg-transparent ${
                        state === "active" ? "bg-white/[0.06]" : ""
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                          state === "done"
                            ? "border-[#8fe04a]/40 bg-[#8fe04a]/15 text-[#a9ec6a]"
                            : state === "active"
                              ? "border-[#8fe04a] bg-[#8fe04a] text-[#0b100c]"
                              : "border-white/12 bg-[#0b100c] text-white/35"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className={`text-[10px] uppercase tracking-[0.16em] ${state === "todo" ? "text-white/35" : "text-[#a9ec6a]"}`}>
                        {String(index + 1).padStart(2, "0")} · {step.label}
                      </span>
                      <span className={`font-display text-[11px] font-semibold leading-tight md:text-[13px] ${state === "todo" ? "text-white/55" : "text-white"}`}>
                        {step.title}
                      </span>
                      <span className="hidden text-[11px] leading-snug text-white/45 md:block">{step.body}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* abas */}
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="flex gap-1.5 overflow-x-auto lg:flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    aria-pressed={active}
                    className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition ${
                      active
                        ? "border-[#8fe04a]/50 bg-[#8fe04a]/12 text-white"
                        : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-[#a9ec6a]" : "text-white/40"}`} />
                    {label}
                    {active ? <ArrowRight className="ml-auto hidden h-3.5 w-3.5 text-[#a9ec6a] lg:block" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="min-h-[300px] rounded-2xl border border-white/10 bg-[#0f1712] p-3 md:min-h-[330px] md:p-4">
              {tab === "monitoramento" ? (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fe04a]" /> Painel ao vivo · 214 cargas
                    </span>
                    <span className="text-[#a9ec6a]">6 em destaque</span>
                  </div>
                  <ul className="divide-y divide-white/6">
                    {LIVE.map((row, index) => (
                      <li
                        key={row.cte}
                        className={`${index >= 4 ? "hidden md:grid" : "grid"} grid-cols-[1fr_auto] items-center gap-2 py-2 md:grid-cols-[120px_1fr_auto_auto]`}
                      >
                        <span className="font-display text-[13px] font-semibold text-white">{row.cte}</span>
                        <span className="hidden text-[12px] text-white/55 md:block">
                          {row.carrier} · {row.route}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${STATUS_STYLE[row.tone]}`}>
                          {row.status}
                        </span>
                        <span className="text-right text-[11px] text-white/45 md:w-24">{row.eta}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {tab === "tracker" ? (
                <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                  <div>
                    <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/40">
                      <span className="inline-flex items-center gap-2">
                        <Truck className="h-3 w-3 text-[#8fe04a]" /> CT-e 3321 · TransSul
                      </span>
                      <span className="text-[#a9ec6a]">em trânsito</span>
                    </div>
                    <ol className="relative ml-2 border-l border-white/10">
                      {TRACK_EVENTS.map((event) => (
                        <li key={event.time} className="relative pb-4 pl-4 last:pb-0">
                          <span
                            className={`absolute -left-[7px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                              event.done ? "border-[#8fe04a] bg-[#8fe04a] text-[#0b100c]" : "border-white/25 bg-[#0b100c]"
                            }`}
                          >
                            {event.done ? <Check className="h-2.5 w-2.5" /> : null}
                          </span>
                          <p className="text-[13px] font-medium text-white">
                            <span className="mr-2 text-white/40">{event.time}</span>
                            {event.title}
                          </p>
                          <p className="text-[11px] text-white/45">{event.detail}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Previsão de entrega</p>
                      <p className="mt-1 font-display text-2xl font-semibold text-white">16:40</p>
                      <p className="text-[11px] text-white/45">Cliente Horizonte · doca 06</p>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[9px] uppercase tracking-[0.14em] text-white/35">
                        <span>Trajeto</span>
                        <span className="text-[#a9ec6a]">82%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#8fe04a]" style={{ width: "82%" }} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-white/50">
                      <Route className="h-3.5 w-3.5 text-[#8fe04a]" /> 412 km percorridos
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === "simulacao" ? (
                <div>
                  <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/40">
                    <span className="inline-flex items-center gap-2">
                      <Calculator className="h-3 w-3 text-[#8fe04a]" /> Simulação · SP → Curitiba · 480 kg
                    </span>
                    <span>3 transportadoras</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-white/8">
                    <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.8fr] gap-2 bg-white/[0.03] px-3 py-2 text-[9px] uppercase tracking-[0.14em] text-white/35">
                      <span>Transportadora</span>
                      <span>Modalidade</span>
                      <span>Prazo</span>
                      <span className="text-right">Valor</span>
                    </div>
                    {SIM.map((option) => (
                      <div
                        key={option.carrier}
                        className={`grid grid-cols-[1.3fr_0.8fr_0.7fr_0.8fr] items-center gap-2 px-3 py-2.5 text-[12px] ${
                          option.best ? "bg-[#8fe04a]/10 text-white" : "text-white/65"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {option.carrier}
                          {option.best ? <BadgeCheck className="h-3.5 w-3.5 text-[#a9ec6a]" /> : null}
                        </span>
                        <span>{option.mode}</span>
                        <span>{option.days}</span>
                        <span className={`text-right font-display font-semibold ${option.best ? "text-[#a9ec6a]" : "text-white"}`}>
                          {money(option.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-[11px] text-white/45">
                    <Check className="h-3.5 w-3.5 text-[#8fe04a]" /> RodoLeste escolhida: 1 dia mais rápida por R$ 83,50 a mais.
                  </p>
                </div>
              ) : null}

              {tab === "auditoria" ? (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
                    <span className="inline-flex items-center gap-2">
                      <ScanSearch className="h-3 w-3 text-[#8fe04a]" /> Auditoria de todos os CT-e recebidos
                    </span>
                    <span className="text-[#a9ec6a]">200 CT-e · {auditDiv.length} {auditDiv.length === 1 ? "divergência" : "divergências"}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-white/8">
                    <div className="grid grid-cols-[70px_1fr_90px_90px_84px] gap-2 bg-white/[0.03] px-3 py-2 text-[9px] uppercase tracking-[0.14em] text-white/35">
                      <span>CT-e</span>
                      <span>Transportadora</span>
                      <span className="text-right">Tabela</span>
                      <span className="text-right">Cobrado</span>
                      <span className="text-right">Status</span>
                    </div>
                    {AUDIT.map((row, index) => (
                      <div
                        key={row.cte}
                        className={`${index >= 6 ? "hidden md:grid" : "grid"} grid-cols-[70px_1fr_90px_90px_84px] items-center gap-2 border-t border-white/6 px-3 py-2 text-[12px]`}
                      >
                        <span className="font-display font-semibold text-white">{row.cte}</span>
                        <span className="truncate text-white/55">{row.carrier}</span>
                        <span className="text-right text-white/70">{money(row.table)}</span>
                        <span className={`text-right ${row.status === "div" ? "font-semibold text-[#ffab9b]" : "text-white/70"}`}>{money(row.charged)}</span>
                        <span className="text-right">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] ${STATUS_STYLE[row.status]}`}>
                            {row.status === "ok" ? "conferido" : row.status === "div" ? "divergência" : "a conferir"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-2 text-white/50">
                      <Boxes className="h-3.5 w-3.5 text-[#8fe04a]" /> {auditOk} de {AUDIT.length} conferidos contra a tabela
                    </span>
                    <span className="inline-flex items-center gap-2 text-[#ffab9b]">
                      <AlertTriangle className="h-3.5 w-3.5" /> diferença encontrada {money(auditDiff)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

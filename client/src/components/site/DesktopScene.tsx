import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Boxes,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  MapPinned,
  Receipt,
  Search,
  Settings,
  Truck,
} from "lucide-react";

const TABS = [
  { id: "simulacao", label: "Simulação de frete", icon: Truck },
  { id: "ocorrencias", label: "Ocorrências", icon: ClipboardList },
  { id: "fatura", label: "Conta frete", icon: Receipt },
  { id: "relatorios", label: "Relatórios", icon: FileSpreadsheet },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CARRIERS = [
  { name: "Transportadora A", sla: "2 dias", price: "R$ 1.248,00", best: false },
  { name: "Transportadora B", sla: "3 dias", price: "R$ 1.096,50", best: true },
  { name: "Transportadora C", sla: "4 dias", price: "R$ 1.182,30", best: false },
];

const EVENTS = [
  { time: "08:40", label: "Coleta realizada", place: "CD São Paulo", tone: "ok" },
  { time: "12:15", label: "Em trânsito · BR-116", place: "Rota Sul", tone: "ok" },
  { time: "14:02", label: "Atraso previsto 40 min", place: "Trecho urbano", tone: "warn" },
  { time: "16:30", label: "Chegada no CD cliente", place: "Curitiba", tone: "idle" },
];

const INVOICES = [
  { doc: "CTe 3321", table: "R$ 1.096,50", billed: "R$ 1.096,50", diff: "ok" },
  { doc: "CTe 3322", table: "R$ 840,00", billed: "R$ 840,00", diff: "ok" },
  { doc: "CTe 3323", table: "R$ 1.310,20", billed: "R$ 1.394,40", diff: "warn" },
];

const KPI = [
  { label: "No prazo", value: "96,2%", hint: "meta 95%" },
  { label: "Conta frete", value: "-11,4%", hint: "vs. mês" },
  { label: "Ocorrências", value: "0,8%", hint: "vs. 1,4%" },
  { label: "Fretes/dia", value: "412", hint: "média" },
];

export default function DesktopScene() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<TabId>("simulacao");

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      setProgress(Math.min(1, Math.max(0, -rect.top / Math.max(1, total))));
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

  const power = Math.min(1, Math.max(0, progress / 0.35));
  const settle = Math.min(1, Math.max(0, (progress - 0.1) / 0.5));
  const tilt = 22 - settle * 22;
  const scale = 0.86 + settle * 0.14;

  return (
    <section id="sistema" ref={sectionRef} className="relative bg-[#0b100c]" style={{ height: "240vh" }}>
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_45%,rgba(143,224,74,0.13),transparent_72%)]" />

        <div className="relative z-10 mb-6 px-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8fe04a]">Escritório · sistema ao vivo</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
            Abra o computador da operação.
          </h2>
        </div>

        <div className="relative w-full max-w-[1180px] px-3" style={{ perspective: "1400px" }}>
          {/* brilho da tela e sombra na mesa */}
          <div className="pointer-events-none absolute left-1/2 top-[12%] h-[70%] w-[78%] -translate-x-1/2 rounded-[50%] bg-[#8fe04a]/12 blur-[80px]" />
          <div className="pointer-events-none absolute inset-x-10 -bottom-4 h-10 rounded-[50%] bg-black/60 blur-2xl" />

          <div
            className="relative origin-bottom transition-transform duration-200 ease-out will-change-transform"
            style={{ transform: `rotateX(${tilt}deg) scale(${scale})` }}
          >
            {/* moldura do monitor */}
            <div className="rounded-[22px] bg-[linear-gradient(180deg,#2a352b_0%,#171e18_38%,#10150f_100%)] p-[7px] shadow-[0_50px_110px_-45px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.06)] md:rounded-[28px] md:p-[9px]">
              <div className="relative overflow-hidden rounded-[16px] bg-[#0a0f0b] ring-1 ring-black/70 md:rounded-[21px]">
                {/* reflexo do vidro */}
                <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(115deg,rgba(255,255,255,0.08)_0%,transparent_38%,transparent_62%,rgba(255,255,255,0.04)_100%)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-white/25" />

                <div className="relative z-10" style={{ opacity: power, transition: "opacity 400ms ease-out" }}>
                  {/* barra do sistema */}
                  <div className="flex items-center justify-between border-b border-white/8 bg-[#0d1410] px-3 py-2 md:px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#ff6b5e]/80" />
                      <span className="h-2 w-2 rounded-full bg-[#f0c46b]/80" />
                      <span className="h-2 w-2 rounded-full bg-[#8fe04a]/80" />
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] text-white/40 md:px-3">
                      <Search className="h-3 w-3" /> app.gettms.com.br/operacao
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/40">
                      <span className="relative">
                        <Bell className="h-3 w-3" />
                        <span className="absolute -right-1.5 -top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#8fe04a] text-[6px] font-bold text-[#0b100c]">3</span>
                      </span>
                      <span className="hidden md:inline">quarta, 18:42</span>
                    </div>
                  </div>

                  <div className="flex h-[360px] md:h-[420px]">
                    {/* menu lateral */}
                    <aside className="hidden w-[168px] shrink-0 flex-col gap-1 border-r border-white/8 bg-[#0c120e] p-3 md:flex">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8fe04a] font-display text-xs font-bold text-[#0b100c]">G</span>
                        <span className="font-display text-sm font-semibold text-white">GetTMS</span>
                      </div>
                      {[
                        { icon: LayoutDashboard, label: "Visão geral" },
                        { icon: Truck, label: "Simulações", active: tab === "simulacao", id: "simulacao" },
                        { icon: ClipboardList, label: "Ocorrências", active: tab === "ocorrencias", id: "ocorrencias" },
                        { icon: Receipt, label: "Conta frete", active: tab === "fatura", id: "fatura" },
                        { icon: FileSpreadsheet, label: "Relatórios", active: tab === "relatorios", id: "relatorios" },
                        { icon: MapPinned, label: "Tracking" },
                        { icon: Boxes, label: "Estoques" },
                        { icon: Settings, label: "Configurações" },
                      ].map(({ icon: Icon, label, active, id }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => id && setTab(id as TabId)}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors ${
                            active ? "bg-[#8fe04a]/14 text-[#b7f27f]" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                      ))}
                      <div className="mt-auto flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8fe04a]/20 text-[9px] font-semibold text-[#b7f27f]">DL</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[10px] text-white/80">Daniel Lima</span>
                          <span className="block text-[8px] text-white/35">Operação · admin</span>
                        </span>
                      </div>
                    </aside>

                    {/* conteúdo */}
                    <div className="flex-1 overflow-hidden p-3 md:p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.18em] text-white/35">Operação · SP → PR</p>
                          <p className="font-display text-sm font-semibold text-white md:text-base">
                            {TABS.find((t) => t.id === tab)?.label}
                          </p>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full bg-[#8fe04a]/12 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-[#a9ec6a]">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fe04a]" /> ao vivo
                        </span>
                      </div>

                      <div className="mb-2 grid grid-cols-3 gap-1.5">
                        {[
                          ["Fretes hoje", "412"],
                          ["No prazo", "96,2%"],
                          ["Economia", "-11,4%"],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5">
                            <p className="text-[7.5px] uppercase tracking-[0.12em] text-white/35">{k}</p>
                            <div className="flex items-end justify-between gap-2">
                              <p className="font-display text-[13px] font-semibold leading-tight text-white">{v}</p>
                              <span className="flex h-4 items-end gap-[2px]">
                                {[40, 62, 50, 78, 66, 92].map((h, i) => (
                                  <span key={i} className="w-[2px] rounded-sm bg-[#8fe04a]/70" style={{ height: `${h}%` }} />
                                ))}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-1.5 overflow-x-auto pb-1 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
                        {TABS.map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setTab(id)}
                            className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-medium ${
                              tab === id ? "bg-[#8fe04a] text-[#0b100c]" : "bg-white/6 text-white/55"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {tab === "simulacao" && (
                        <div className="mt-2">
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            {[
                              ["Origem", "São Paulo · SP"],
                              ["Destino", "Curitiba · PR"],
                              ["Peso", "1.240 kg"],
                            ].map(([k, v]) => (
                              <div key={k} className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
                                <span className="block text-[8px] uppercase tracking-[0.14em] text-white/35">{k}</span>
                                <span className="block truncate text-white/85">{v}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 overflow-hidden rounded-lg border border-white/8">
                            {CARRIERS.map((carrier) => (
                              <div
                                key={carrier.name}
                                className={`flex items-center justify-between gap-2 px-2.5 py-2 text-[10px] md:text-[11px] ${
                                  carrier.best ? "bg-[#8fe04a]/12" : "odd:bg-white/[0.02]"
                                }`}
                              >
                                <span className={carrier.best ? "font-medium text-white" : "text-white/70"}>{carrier.name}</span>
                                <span className="text-white/45">{carrier.sla}</span>
                                <span className={`font-display font-semibold ${carrier.best ? "text-[#b7f27f]" : "text-white/80"}`}>
                                  {carrier.price}
                                </span>
                                {carrier.best ? (
                                  <span className="rounded-full bg-[#8fe04a] px-1.5 py-0.5 text-[8px] font-bold text-[#0b100c]">melhor</span>
                                ) : (
                                  <span className="w-9" />
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 hidden items-center gap-3 rounded-lg border border-white/8 bg-[linear-gradient(180deg,rgba(143,224,74,0.06),rgba(255,255,255,0.02))] px-2.5 py-2 md:flex">
                            <svg viewBox="0 0 180 40" className="h-9 flex-1" aria-hidden="true">
                              <path d="M8 32 C 46 32, 54 8, 92 8 S 140 26, 172 12" fill="none" stroke="rgba(143,224,74,0.55)" strokeWidth="1.6" strokeDasharray="4 3" />
                              <circle cx="8" cy="32" r="3" fill="#8fe04a" />
                              <circle cx="172" cy="12" r="3" fill="#f4f8ef" />
                              <circle cx="92" cy="8" r="2.4" fill="rgba(244,248,239,0.5)" />
                            </svg>
                            <div className="text-[9px] leading-tight text-white/45">
                              <p className="text-white/70">408 km · rodovia + urbano</p>
                              <p>restrição de circulação respeitada</p>
                            </div>
                          </div>
                                                    <button type="button" className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#8fe04a] py-1.5 text-[10px] font-semibold text-[#0b100c]">
                            Aprovar cotação e gerar pedido #4821 <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {tab === "ocorrencias" && (
                        <div className="mt-2 space-y-1.5">
                          {EVENTS.map((event) => (
                            <div key={event.time} className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2">
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                  event.tone === "ok" ? "bg-[#8fe04a]" : event.tone === "warn" ? "bg-[#f0c46b]" : "bg-white/25"
                                }`}
                              />
                              <span className="w-10 text-[9px] text-white/35">{event.time}</span>
                              <span className="flex-1 truncate text-[10px] text-white/80">{event.label}</span>
                              <span className="hidden text-[9px] text-white/35 md:inline">{event.place}</span>
                            </div>
                          ))}
                          <div className="rounded-lg border border-[#f0c46b]/25 bg-[#f0c46b]/8 px-2.5 py-2 text-[10px] text-[#f6d9a2]">
                            Atraso comunicado ao cliente · SLA preservado
                          </div>
                        </div>
                      )}

                      {tab === "fatura" && (
                        <div className="mt-2 overflow-hidden rounded-lg border border-white/8">
                          <div className="grid grid-cols-4 gap-2 bg-white/[0.04] px-2.5 py-1.5 text-[8px] uppercase tracking-[0.14em] text-white/35">
                            <span>Documento</span>
                            <span>Tabela</span>
                            <span>Faturado</span>
                            <span>Status</span>
                          </div>
                          {INVOICES.map((invoice) => (
                            <div key={invoice.doc} className="grid grid-cols-4 items-center gap-2 px-2.5 py-2 text-[10px] odd:bg-white/[0.02]">
                              <span className="text-white/80">{invoice.doc}</span>
                              <span className="text-white/55">{invoice.table}</span>
                              <span className="font-display text-white/85">{invoice.billed}</span>
                              <span className={invoice.diff === "ok" ? "text-[#b7f27f]" : "text-[#f0c46b]"}>
                                {invoice.diff === "ok" ? "conferido" : "divergência"}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-white/8 bg-[#8fe04a]/10 px-2.5 py-2 text-[10px] text-[#cdf5a6]">
                            Diferença encontrada: R$ 84,20 · contestação aberta
                          </div>
                        </div>
                      )}

                      {tab === "relatorios" && (
                        <div className="mt-2">
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            {KPI.map((kpi) => (
                              <div key={kpi.label} className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2">
                                <p className="text-[8px] uppercase tracking-[0.12em] text-white/35">{kpi.label}</p>
                                <p className="font-display text-sm font-semibold text-white md:text-base">{kpi.value}</p>
                                <p className="text-[8px] text-[#a9ec6a]">{kpi.hint}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex h-16 items-end gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-2 pb-1.5 md:h-20">
                            {[38, 54, 46, 62, 58, 74, 66, 82, 70, 88, 78, 92].map((h, i) => (
                              <span key={i} className="flex-1 rounded-t bg-[#8fe04a]/70" style={{ height: `${h}%` }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/8 bg-[#0d1410] px-3 py-1.5 text-[8.5px] text-white/35 md:px-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#8fe04a]" /> sincronizado · 18:42
                    </span>
                    <span className="hidden md:inline">3 transportadoras consultadas · API integrada</span>
                    <span>GetTMS v4.2</span>
                  </div>
                </div>

                {/* tela desligada */}
                <div
                  className="pointer-events-none absolute inset-0 z-30 bg-[#070b08]"
                  style={{ opacity: 1 - power, transition: "opacity 300ms ease-out" }}
                />
              </div>
            </div>

            {/* suporte e base */}
            <div
              className="mx-auto h-7 w-14 bg-[linear-gradient(180deg,#232c25,#141a15)] md:h-9 md:w-16"
              style={{ clipPath: "polygon(28% 0, 72% 0, 100% 100%, 0 100%)" }}
            />
            <div className="mx-auto h-2 w-52 rounded-full bg-[linear-gradient(180deg,#2b352d,#131913)] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)] md:w-64" />
            {/* acessórios de mesa */}
            <div className="relative mx-auto mt-2 h-8 w-full max-w-[560px]">
              <div className="absolute left-1/2 top-0 h-[22px] w-[230px] -translate-x-1/2 rounded-[6px] bg-[linear-gradient(180deg,#28322a,#161c17)] shadow-[0_10px_18px_-10px_rgba(0,0,0,0.85)] md:w-[320px]">
                <div className="absolute inset-x-3 top-[4px] grid grid-cols-14 gap-[2px] opacity-35">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span key={`a${i}`} className="h-[4px] rounded-[1px] bg-white/60" />
                  ))}
                </div>
                <div className="absolute inset-x-6 top-[11px] grid grid-cols-11 gap-[2px] opacity-25">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <span key={`b${i}`} className="h-[4px] rounded-[1px] bg-white/60" />
                  ))}
                </div>
              </div>
              <div className="absolute left-[calc(50%+130px)] top-0 hidden h-5 w-3 rounded-full bg-[#2a332c] md:block" />
              <div className="absolute left-[calc(50%+210px)] top-0 hidden h-6 w-5 rounded-b-[6px] bg-[linear-gradient(180deg,#2c362e,#1a211b)] md:block">
                <span className="absolute left-1/2 top-[-2px] h-1 w-4 -translate-x-1/2 rounded-full bg-[#8fe04a]/50" />
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 mt-6 hidden items-center gap-2 text-[11px] text-white/35 md:flex">
          clique nas abas do sistema para navegar <ChevronRight className="h-3 w-3" />
        </p>
      </div>
    </section>
  );
}

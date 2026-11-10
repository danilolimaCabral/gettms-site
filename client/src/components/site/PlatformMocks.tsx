import { AlertTriangle, ArrowRight, CheckCircle2, Clock, MapPin, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

function Window({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-ink/10 bg-ink/[0.025] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand/60" />
        </div>
        <span className="truncate rounded-md bg-paper px-2 py-1 font-mono text-[10px] text-ink/40">
          app.gettms.com.br/{path}
        </span>
      </div>
      <div className="p-4 md:p-6">{children}</div>
    </div>
  );
}

export function SimulationMock() {
  const options = [
    { name: "Transp. Alfa", price: "R$ 486,30", eta: "2 dias úteis", tag: "Menor prazo", best: false },
    { name: "Transp. Beta", price: "R$ 421,90", eta: "3 dias úteis", tag: "Melhor custo", best: true },
    { name: "Transp. Gama", price: "R$ 505,10", eta: "2 dias úteis", tag: "", best: false },
  ];

  return (
    <Window path="simulacao">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-ink/40">Simulação #4821</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">Curitiba, PR → São Paulo, SP</p>
        </div>
        <span className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-[10px] font-medium text-brand-dark">
          3 opções
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-ink/45">
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3 text-brand-dark" /> 2 volumes</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>320 kg</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>Fracionado · coleta hoje</span>
      </div>

      <div className="mt-5 space-y-2">
        {options.map((option) => (
          <div
            key={option.name}
            className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors ${
              option.best
                ? "border-brand/45 bg-brand-soft"
                : "border-ink/10 bg-ink/[0.02] hover:border-ink/18"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink/90">{option.name}</p>
              <p className="text-[11px] text-ink/40">Prazo estimado · {option.eta}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-sm font-semibold text-ink">{option.price}</p>
              {option.tag && (
                <p className={`text-[10px] uppercase tracking-[0.14em] ${option.best ? "text-brand-dark" : "text-ink/40"}`}>
                  {option.tag}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-paper px-4 py-3">
        <span className="text-[11px] text-ink/45">Economia vs. maior cotação</span>
        <span className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-brand-dark">
          <TrendingDown className="h-3.5 w-3.5" /> R$ 83,20
        </span>
      </div>
    </Window>
  );
}

export function OccurrenceMock() {
  const rows = [
    { time: "08:12", title: "Coleta atrasada — Transp. Beta", status: "Em tratativa", tone: "warn" },
    { time: "09:40", title: "Responsável atribuído ao time de SP", status: "Resolvido", tone: "ok" },
    { time: "11:05", title: "Cliente notificado automaticamente", status: "Concluído", tone: "ok" },
    { time: "13:22", title: "Carga em rota — novo prazo calculado", status: "Em monitoramento", tone: "info" },
  ];

  return (
    <Window path="ocorrencias">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold text-ink">Ocorrência #9012</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] text-amber-200">
          <AlertTriangle className="h-3 w-3" /> Alta prioridade
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink/40">CT-e 3524 · Alimentos · Destino Campinas, SP</p>

      <div className="mt-6 space-y-4 border-l border-ink/12 pl-5">
        {rows.map((row) => (
          <div key={row.time} className="relative">
            <span
              className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                row.tone === "warn" ? "bg-amber-300" : row.tone === "ok" ? "bg-brand" : "bg-sky-300"
              }`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink/85">{row.title}</p>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35">{row.status}</span>
            </div>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink/35">
              <Clock className="h-3 w-3" /> {row.time}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl bg-paper px-4 py-3 text-[11px]">
        <span className="text-ink/45">SLA de resposta</span>
        <span className="font-medium text-brand-dark">100% dentro do prazo</span>
      </div>
    </Window>
  );
}

export function AuditMock() {
  const rows = [
    { doc: "CT-e 35241", contracted: "R$ 421,90", charged: "R$ 468,20", diff: "+R$ 46,30" },
    { doc: "CT-e 35248", contracted: "R$ 289,50", charged: "R$ 289,50", diff: "OK" },
    { doc: "CT-e 35250", contracted: "R$ 612,00", charged: "R$ 659,90", diff: "+R$ 47,90" },
    { doc: "CT-e 35261", contracted: "R$ 198,40", charged: "R$ 198,40", diff: "OK" },
  ];

  return (
    <Window path="afericao">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold text-ink">Aferição · Fatura 11/2026</p>
        <span className="rounded-full border border-ink/12 px-3 py-1 text-[10px] text-ink/50">128 CT-es</span>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10">
        <div className="grid grid-cols-4 gap-2 bg-ink/[0.03] px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-ink/35">
          <span>Documento</span>
          <span className="text-right">Contratado</span>
          <span className="text-right">Cobrado</span>
          <span className="text-right">Divergência</span>
        </div>
        {rows.map((row) => (
          <div key={row.doc} className="grid grid-cols-4 gap-2 border-t border-ink/8 px-4 py-2.5 text-[11px]">
            <span className="font-mono text-ink/60">{row.doc}</span>
            <span className="text-right text-ink/70">{row.contracted}</span>
            <span className="text-right text-ink/70">{row.charged}</span>
            <span className={`text-right font-medium ${row.diff === "OK" ? "text-brand-dark" : "text-amber-300"}`}>
              {row.diff}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-paper p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/35">A recuperar</p>
          <p className="mt-1 font-display text-xl font-semibold text-brand-dark">R$ 94,20</p>
        </div>
        <div className="rounded-xl bg-paper p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/35">Divergências</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">2 de 4</p>
        </div>
      </div>
    </Window>
  );
}

export function ReportMock() {
  const bars = [62, 78, 55, 88, 71, 94, 66, 82];
  const labels = ["S", "T", "Q", "Q", "S", "S", "T", "Q"];

  return (
    <Window path="relatorios">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold text-ink">Desempenho por transportadora</p>
        <span className="text-[10px] uppercase tracking-[0.16em] text-ink/35">Últimos 90 dias</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { label: "Prazo", value: "94%" },
          { label: "Ocorrências", value: "-18%" },
          { label: "Custo/frete", value: "-7%" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-ink/10 bg-ink/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink/35">{kpi.label}</p>
            <p className="mt-1 font-display text-lg font-semibold text-ink">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex h-32 items-end gap-2">
        {bars.map((bar, index) => (
          <div key={`${bar}-${index}`} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={`w-full rounded-t-md transition-all duration-700 ${
                index === 5 ? "bg-gradient-to-t from-[#63b32e] to-[#b6f472]" : "bg-ink/12"
              }`}
              style={{ height: `${bar}%` }}
            />
            <span className="text-[9px] text-ink/25">{labels[index]}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-ink/45">
        <CheckCircle2 className="h-3.5 w-3.5 text-brand-dark" />
        Indicadores consolidados de 12 transportadoras integradas
        <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink/30" />
      </div>
    </Window>
  );
}

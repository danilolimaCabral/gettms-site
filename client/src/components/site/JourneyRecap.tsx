import { ArrowRight, Building2, CheckCircle2, MapPin, Route, Store, Warehouse } from "lucide-react";

const STAGES = [
  { label: "Centro de distribuição", detail: "carregamento conferido", icon: Warehouse },
  { label: "Avenida", detail: "semáforos e janelas de entrega", icon: Route },
  { label: "Via expressa", detail: "tracking sem ponto cego", icon: MapPin },
  { label: "Periferia", detail: "última milha monitorada", icon: Store },
  { label: "Cliente Horizonte", detail: "ré na doca e conferência", icon: Building2 },
];

export default function JourneyRecap() {
  return (
    <section id="jornada" className="relative overflow-hidden bg-[#0b100c] py-16 md:py-20">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_60%_at_50%_0%,rgba(143,224,74,0.12),transparent_70%)]" />
      <div className="container-wide relative">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8fe04a]">A jornada de uma carga</p>
            <h2 className="mt-2 max-w-xl font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
              Do centro de distribuição até a doca do cliente, com tudo registrado.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/55">
            A mesma cena que abre o site: um pedido, um CT-e e a operação inteira acompanhando do carregamento à entrega.
          </p>
        </div>

        <ol className="mt-8 grid gap-3 md:grid-cols-5 md:gap-2">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const last = index === STAGES.length - 1;
            return (
              <li key={stage.label} className="relative">
                <div
                  className={`flex h-full items-start gap-3 rounded-xl border px-3 py-3 md:flex-col md:gap-2 ${
                    last ? "border-[#8fe04a]/45 bg-[#8fe04a]/10" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      last ? "bg-[#8fe04a] text-[#0b100c]" : "bg-[#8fe04a]/15 text-[#a9ec6a]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[10px] uppercase tracking-[0.16em] text-white/35">{String(index + 1).padStart(2, "0")}</span>
                    <span className="block font-display text-sm font-semibold text-white">{stage.label}</span>
                    <span className="block text-[11px] leading-snug text-white/45">{stage.detail}</span>
                  </span>
                </div>
                {!last ? (
                  <ArrowRight className="absolute -right-1.5 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-white/20 md:block" />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-white/55">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#8fe04a]" /> 200 pedidos
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#8fe04a]" /> 200 CT-e conferidos
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#8fe04a]" /> comprovante assinado na doca
          </span>
        </div>
      </div>
    </section>
  );
}

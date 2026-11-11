import { Check, MapPin, PackageCheck, Phone, Truck } from "lucide-react";

const STEPS = [
  { label: "Pedido confirmado", time: "08:12" },
  { label: "Separado no CD", time: "10:46" },
  { label: "Em trânsito", time: "11:05" },
  { label: "Saiu para entrega", time: "13:58" },
  { label: "Entregue na doca 06", time: "—" },
];

export default function CustomerTrackPanel({ active, progress }: { active: boolean; progress: number }) {
  // progresso dentro do capítulo (0 → 1)
  const local = Math.min(1, Math.max(0, (progress - 0.7) / 0.07));
  const stepIndex = Math.min(STEPS.length - 1, 3 + (local > 0.65 ? 1 : 0));
  const eta = local > 0.65 ? "Chegando agora" : `${Math.max(4, Math.round(18 - local * 14))} min`;
  return (
    <div
      className={`pointer-events-none absolute inset-x-3 bottom-20 z-20 transition-all duration-500 md:inset-x-auto md:right-6 md:top-24 md:bottom-auto md:w-[330px] ${
        active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 md:-translate-y-2 md:translate-x-4"
      }`}
      aria-hidden={!active}
    >
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0b110d]/92 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8fe04a]/15 text-[#a9ec6a]">
              <PackageCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Portal do cliente</p>
              <p className="font-display text-sm font-semibold text-white">Pedido #4821</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#8fe04a]/12 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[#a9ec6a]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fe04a]" /> ao vivo
          </span>
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Previsão de chegada</p>
          <p className="font-display text-2xl font-semibold leading-tight text-white">{eta}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/50">
            <MapPin className="h-3 w-3 text-[#8fe04a]" /> Cliente Horizonte · Doca 06
          </p>
        </div>

        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8fe04a]/15 text-[#a9ec6a]">
            <Truck className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1">
            <span className="block text-[11px] font-medium text-white">GT-1024 · Carlos M.</span>
            <span className="block text-[10px] text-white/45">Scania R450 · carreta 3 eixos</span>
          </span>
          <Phone className="h-3.5 w-3.5 text-white/30" />
        </div>

        <ol className="space-y-2 px-4 pb-4">
          {STEPS.map((step, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={step.label} className="flex items-center gap-2.5">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    done ? "border-[#8fe04a] bg-[#8fe04a] text-[#0b100c]" : current ? "border-[#8fe04a] bg-transparent" : "border-white/20"
                  }`}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : current ? <span className="h-1.5 w-1.5 rounded-full bg-[#8fe04a]" /> : null}
                </span>
                <span className={`flex-1 text-[12px] ${done || current ? "text-white" : "text-white/40"}`}>{step.label}</span>
                <span className="text-[10px] text-white/35">{step.time}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

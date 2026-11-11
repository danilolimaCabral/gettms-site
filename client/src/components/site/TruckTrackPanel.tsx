import { Check, MapPin, Phone, Truck, X } from "lucide-react";
import type { TruckInfo } from "@/scene/logisticsScene";

const STEPS = ["Pedido confirmado", "Separado no CD", "Em trânsito", "Em rota de entrega"];

function stepIndexFor(status: string) {
  const value = status.toLowerCase();
  if (value.includes("entregue")) return 3;
  if (value.includes("última milha") || value.includes("saindo") || value.includes("rota")) return 3;
  if (value.includes("trânsito") || value.includes("via expressa")) return 2;
  if (value.includes("coleta")) return 1;
  return 2;
}

export default function TruckTrackPanel({ info, onClose }: { info: TruckInfo | null; onClose: () => void }) {
  const stepIndex = info ? stepIndexFor(info.status) : 0;
  return (
    <div
      className={`pointer-events-none absolute inset-x-3 bottom-20 z-30 transition-all duration-500 md:inset-x-auto md:right-6 md:top-24 md:bottom-auto md:w-[340px] ${
        info ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 md:-translate-y-2 md:translate-x-4"
      }`}
      aria-hidden={!info}
    >
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-white/12 bg-[#0b110d]/92 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8fe04a]/15 text-[#a9ec6a]">
              <Truck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Tracking do caminhão</p>
              <p className="font-display text-sm font-semibold text-white">
                {info ? `${info.plate} · Pedido ${info.order}` : "—"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar tracking"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8fe04a]/12 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[#a9ec6a]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fe04a]" /> {info?.status ?? ""}
          </span>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/70">
            <MapPin className="h-3 w-3 shrink-0 text-[#8fe04a]" /> {info?.route ?? ""}
          </p>
        </div>
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8fe04a]/15 text-[#a9ec6a]">
            <Truck className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1">
            <span className="block text-[11px] font-medium text-white">{info?.driver ?? ""}</span>
            <span className="block text-[10px] text-white/45">ETA {info?.eta ?? "—"} · telemetria ao vivo</span>
          </span>
          <Phone className="h-3.5 w-3.5 text-white/30" />
        </div>
        <ol className="space-y-2 px-4 pb-3">
          {STEPS.map((step, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={step} className="flex items-center gap-2.5">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    done ? "border-[#8fe04a] bg-[#8fe04a] text-[#0b100c]" : current ? "border-[#8fe04a] bg-transparent" : "border-white/20"
                  }`}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : current ? <span className="h-1.5 w-1.5 rounded-full bg-[#8fe04a]" /> : null}
                </span>
                <span className={`flex-1 text-[12px] ${done || current ? "text-white" : "text-white/40"}`}>{step}</span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("gettms:seek", { detail: 0.72 }));
            onClose();
          }}
          className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl bg-[#8fe04a] px-3 py-2 text-[12px] font-semibold text-[#0b100c] transition hover:bg-[#a2ee62]"
        >
          Acompanhar no filme
        </button>
      </div>
    </div>
  );
}

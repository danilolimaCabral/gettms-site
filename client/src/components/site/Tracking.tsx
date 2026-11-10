import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Radio } from "lucide-react";
import Reveal from "./Reveal";
import { DEMO_URL, TRACKING_STEPS } from "@/content/site";
import SegmentVisual from "./SegmentVisual";


export default function Tracking() {
  const [active, setActive] = useState(0);

  return (
    <section id="tracking" className="relative overflow-hidden py-24 md:py-32">
      <div className="container-wide">
        <Reveal className="mb-14 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end">
          <div>
            <p className="eyebrow mb-5">Tracking e fluxo logístico</p>
            <h2 className="display-lg text-ink">
              O fluxo completo,
              <br />
              <span className="text-gradient">visível para todos.</span>
            </h2>
          </div>
          <p className="lede max-w-md md:pb-2">
            Do embarque na doca até a entrega comprovada, cada etapa gera um evento rastreável — para a
            operação, para o cliente e para a conferência da fatura.
          </p>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal className="relative overflow-hidden rounded-2xl border border-ink/12">
            <div className="min-h-[360px] w-full">
              <SegmentVisual kind="tracking" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#060b07] via-[#060b07]/45 to-transparent" />

            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/75 backdrop-blur">
                <Radio className="h-3 w-3 text-[#8fe04a]" /> Central de operações
              </span>
              <span className="rounded-full border border-[#8fe04a]/40 bg-[#8fe04a]/15 px-3 py-1 text-[10px] text-[#cdf5a6]">
                Ao vivo
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
              <div className="rounded-xl border border-white/12 bg-[#060b07]/80 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/45">
                  <span>Carga #GT-48219</span>
                  <span className="text-[#8fe04a]">Em trânsito</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {TRACKING_STEPS.map((step, index) => (
                    <div key={step.id} className="flex flex-1 items-center gap-2">
                      <span
                        className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                          index <= active ? "bg-[#8fe04a]" : "bg-white/15"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-white/45">
                  {TRACKING_STEPS[active].event} · atualizado há 2 min
                </p>
              </div>
            </div>
          </Reveal>

          <div className="flex flex-col gap-2">
            {TRACKING_STEPS.map((step, index) => {
              const isActive = index === active;
              return (
                <button
                  key={step.id}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  className={`group rounded-2xl border px-5 py-5 text-left transition-all duration-300 ${
                    isActive
                      ? "border-brand/40 bg-brand-soft"
                      : "border-ink/10 bg-ink/[0.02] hover:border-ink/18"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-ink/40">
                      <span className={isActive ? "text-brand-dark" : ""}>{String(index + 1).padStart(2, "0")}</span>
                      {step.label}
                    </span>
                    <CheckCircle2
                      className={`h-4 w-4 transition-colors ${
                        index <= active ? "text-brand-dark" : "text-ink/15"
                      }`}
                    />
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold text-ink">{step.title}</h3>
                  <div
                    className={`grid transition-all duration-500 ${
                      isActive ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm leading-relaxed text-ink/55">{step.body}</p>
                      <p className="mt-3 inline-flex rounded-full bg-paper px-3 py-1 font-mono text-[10px] text-brand-dark">
                        {step.event}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            <a href={DEMO_URL} target="_blank" rel="noreferrer" className="btn btn-ghost mt-4 w-fit">
              Ver o tracking ao vivo
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

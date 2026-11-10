import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";
import { AuditMock, OccurrenceMock, ReportMock, SimulationMock } from "./PlatformMocks";
import { DEMO_URL, FEATURES } from "@/content/site";

const MOCKS = {
  simulacao: SimulationMock,
  ocorrencias: OccurrenceMock,
  afericao: AuditMock,
  relatorios: ReportMock,
} as const;

export default function Platform() {
  const [activeId, setActiveId] = useState<keyof typeof MOCKS>("simulacao");
  const ActiveMock = MOCKS[activeId];

  return (
    <section id="plataforma" className="relative overflow-hidden py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />
      <div className="container-wide relative">
        <Reveal className="mb-14 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end">
          <div>
            <p className="eyebrow mb-5">A plataforma</p>
            <h2 className="display-lg text-ink">
              Quatro frentes.
              <br />
              <span className="text-gradient">Uma operação só.</span>
            </h2>
          </div>
          <p className="lede max-w-md md:pb-2">
            Simulação, ocorrências, aferição e relatórios no mesmo ambiente — para que a decisão de hoje
            não dependa de cruzar três sistemas amanhã.
          </p>
        </Reveal>

        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="flex flex-col">
            {FEATURES.map((feature) => {
              const isActive = feature.id === activeId;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onMouseEnter={() => setActiveId(feature.id as keyof typeof MOCKS)}
                  onFocus={() => setActiveId(feature.id as keyof typeof MOCKS)}
                  onClick={() => setActiveId(feature.id as keyof typeof MOCKS)}
                  className={`group relative border-t border-ink/10 py-6 text-left transition-colors last:border-b ${
                    isActive ? "text-ink" : "text-ink/55 hover:text-ink/85"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-0 h-px w-full origin-left bg-brand transition-transform duration-500 ${
                      isActive ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                  <div className="flex items-start gap-5">
                    <span
                      className={`mt-1 font-display text-[11px] tracking-[0.2em] transition-colors ${
                        isActive ? "text-brand-dark" : "text-ink/30"
                      }`}
                    >
                      {feature.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-xl font-semibold tracking-[-0.02em] md:text-2xl">
                        {feature.title}
                      </h3>
                      <div
                        className={`grid transition-all duration-500 ${
                          isActive ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <p className="max-w-md text-sm leading-relaxed text-ink/55">{feature.body}</p>
                          <ul className="mt-4 flex flex-wrap gap-2">
                            {feature.bullets.map((bullet) => (
                              <li
                                key={bullet}
                                className="rounded-full border border-ink/12 bg-ink/[0.03] px-3 py-1 text-[11px] text-ink/60"
                              >
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight
                      className={`mt-1 h-4 w-4 shrink-0 transition-all ${
                        isActive ? "text-brand-dark opacity-100" : "opacity-0 group-hover:opacity-60"
                      }`}
                    />
                  </div>
                </button>
              );
            })}

            <a href={DEMO_URL} target="_blank" rel="noreferrer" className="btn btn-ghost mt-10 w-fit">
              Ver a plataforma em ação
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <div className="relative lg:sticky lg:top-28 lg:self-start">
            <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_50%_30%,rgba(143,224,74,0.16),transparent_65%)] blur-xl" />
            <div key={activeId} className="relative animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
              <ActiveMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";
import { DEMO_URL } from "@/content/site";

const STEPS = [
  {
    number: "01",
    title: "Diagnóstico da operação",
    body: "Mapeamos volumes, transportadoras, rotas e pontos de retrabalho. Em poucos dias você recebe um retrato claro de onde o custo está escapando.",
    detail: "Reunião de 45 min · sem compromisso",
  },
  {
    number: "02",
    title: "Implantação assistida",
    body: "Tabelas, integrações e usuários configurados com o time GetTMS acompanhando cada etapa — do primeiro cadastro ao primeiro frete simulado.",
    detail: "Time dedicado · acompanhamento semanal",
  },
  {
    number: "03",
    title: "Operação com dados",
    body: "A rotina passa a rodar no mesmo ambiente: simulação, ocorrências, tracking e aferição de faturas alimentando os relatórios da diretoria.",
    detail: "Relatórios automáticos · revisão contínua",
  },
];

export default function Steps() {
  return (
    <section id="implantacao" className="relative overflow-hidden border-y border-ink/10 bg-white py-24 md:py-32">
      <div className="container-wide">
        <Reveal className="mb-16 grid gap-8 md:grid-cols-[1fr_0.8fr] md:items-end">
          <div>
            <p className="eyebrow mb-5">Como começa</p>
            <h2 className="display-lg text-ink">
              Da primeira conversa
              <br />
              <span className="text-gradient">à operação rodando.</span>
            </h2>
          </div>
          <p className="lede max-w-md md:pb-2">
            Sem projeto de meses. A implantação é guiada por quem já colocou operações de diferentes
            segmentos para rodar no GetTMS.
          </p>
        </Reveal>

        <div className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          <div className="pointer-events-none absolute left-0 right-0 top-[26px] hidden h-px bg-gradient-to-r from-brand/60 via-ink/12 to-transparent md:block" />
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 90} className="relative">
              <div className="flex items-center gap-4">
                <span className="relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-brand/30 bg-white font-display text-sm font-semibold text-brand-dark shadow-[0_10px_30px_-18px_rgba(79,158,34,0.8)]">
                  {step.number}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-ink/35">{step.detail}</span>
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-ink md:text-2xl">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/55">{step.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 flex flex-wrap items-center gap-4">
          <a href={DEMO_URL} target="_blank" rel="noreferrer" className="btn btn-primary">
            Começar pelo diagnóstico
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a href="#maturidade" className="btn btn-ghost">
            Avaliar minha operação agora
          </a>
        </Reveal>
      </div>
    </section>
  );
}

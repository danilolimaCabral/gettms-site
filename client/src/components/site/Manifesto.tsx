import Reveal from "./Reveal";

const PILLARS = [
  { label: "Simulação de fretes", text: "Cote com todas as transportadoras antes de decidir." },
  { label: "Redução de custos", text: "Aferição de faturas e escolha estratégica de fornecedor." },
  { label: "Decisões com dados", text: "Indicadores por rota, cliente e transportadora." },
];

export default function Manifesto() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="container-wide">
        <Reveal>
          <p className="eyebrow mb-8">Por que GetTMS</p>
          <h2 className="max-w-5xl font-display text-[clamp(1.7rem,3.6vw,3.4rem)] font-medium leading-[1.18] tracking-[-0.035em] text-ink/35">
            Uma plataforma TMS criada para{" "}
            <span className="text-ink">simplificar e impulsionar a gestão logística</span> — com simulação
            de fretes, controle de ocorrências e relatórios em tempo real. Sua empresa{" "}
            <span className="text-brand-dark">transporta melhor</span>, decide com mais agilidade e reduz
            custos com inteligência.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/8 md:grid-cols-3">
          {PILLARS.map((pillar, index) => (
            <Reveal key={pillar.label} delay={index * 80} className="bg-white p-6 md:p-8">
              <p className="font-display text-[11px] tracking-[0.2em] text-brand-dark">
                0{index + 1}
              </p>
              <p className="mt-4 font-display text-xl font-semibold text-ink">{pillar.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/45">{pillar.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

import { CLIENTS } from "@/content/site";

export default function Clients() {
  const items = [...CLIENTS, ...CLIENTS];

  return (
    <section id="clientes" className="relative border-y border-ink/10 bg-white py-14 md:py-16">
      <div className="container-wide mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-3">Nossos clientes</p>
          <h2 className="display-md max-w-xl text-ink">
            Operações que confiam a rotina ao GetTMS
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink/50">
          Indústrias, distribuidores e varejistas que precisam de previsibilidade em cada embarque.
        </p>
      </div>

      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="animate-marquee flex w-max items-center gap-14 px-6">
          {items.map((client, index) => (
            <span
              key={`${client}-${index}`}
              className="whitespace-nowrap font-display text-xl font-semibold tracking-[-0.02em] text-ink/35 transition-colors hover:text-brand-dark md:text-2xl"
            >
              {client}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

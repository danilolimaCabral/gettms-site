import { CLIENTS } from "@/content/site";

export default function Clients() {
  const items = [...CLIENTS, ...CLIENTS];

  return (
    <section id="clientes" className="relative border-y border-ink/10 bg-surface py-14 md:py-16">
      <div className="container-wide mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-3">Nossos clientes</p>
          <h2 className="display-md max-w-xl text-ink">
            Operações que confiam a rotina ao GetTMS
          </h2>
        </div>
        <div className="max-w-sm">
          <p className="text-sm leading-relaxed text-ink/50">
            Indústrias, distribuidores e varejistas que precisam de previsibilidade em cada embarque.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-[11px] text-ink/60">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Operações atendidas em todo o Brasil
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="animate-marquee flex w-max items-center gap-14 px-6">
          {items.map((client, index) => (
            <span
              key={`${client}-${index}`}
              className="whitespace-nowrap rounded-xl border border-ink/8 bg-paper px-5 py-2.5 font-display text-lg font-semibold tracking-[-0.02em] text-ink/45 transition-colors hover:border-brand/30 hover:text-brand-dark md:text-xl"
            >
              {client}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

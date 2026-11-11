import { Boxes, Package, Plane, Truck } from "lucide-react";

const MODALITIES = [
  {
    title: "Carga fracionada",
    body: "Envios otimizados para volumes menores, com rotas compartilhadas e custo-benefício ideal.",
    icon: Package,
  },
  {
    title: "Carga fechada",
    body: "Transporte dedicado para grandes volumes, com mais segurança e rastreabilidade.",
    icon: Truck,
  },
  {
    title: "Transporte aéreo",
    body: "Agilidade nas entregas urgentes, com prazos reduzidos e rastreio em tempo real.",
    icon: Plane,
  },
  {
    title: "Alta capacidade de carga",
    body: "Infraestrutura pronta para atender operações robustas com eficiência máxima.",
    icon: Boxes,
  },
];

export default function Modalities() {
  return (
    <section id="modalidades" className="relative bg-paper py-16 md:py-20">
      <div className="container-wide">
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <p className="eyebrow flex items-center gap-3">
              <span className="h-px w-10 bg-brand/70" />
              Modalidades
            </p>
            <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">
              Uma plataforma para cada tipo de carga.
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-relaxed text-ink/60 md:justify-self-end">
            Integre as transportadoras que você já usa, simule fretes em tempo real e escale de pequenas a grandes operações sem trocar de sistema.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODALITIES.map(({ title, body, icon: Icon }) => (
            <article
              key={title}
              className="group flex h-full flex-col rounded-2xl border border-ink/10 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_24px_50px_-38px_rgba(10,15,11,0.55)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 text-brand-dark">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-4 font-display text-[15px] font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/55">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

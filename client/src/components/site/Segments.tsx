import SegmentVisual from "./SegmentVisual";
import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";
import { SEGMENTS, whatsappLink } from "@/content/site";

export default function Segments() {
  return (
    <section id="segmentos" className="relative py-24 md:py-32">
      <div className="container-wide">
        <Reveal className="mb-16 grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end">
          <div>
            <p className="eyebrow mb-5">Como o GetTMS ajuda cada operação</p>
            <h2 className="display-lg text-ink">
              A mesma plataforma.
              <br />
              <span className="text-gradient">Cenários diferentes.</span>
            </h2>
          </div>
          <p className="lede max-w-md md:pb-2">
            Alimentos, farma, construção e e-commerce têm exigências próprias de prazo, rastreabilidade e
            custo. O GetTMS organiza a rotina de cada um sem criar ilhas de informação.
          </p>
        </Reveal>

        <div className="border-t border-ink/10">
          {SEGMENTS.map((segment, index) => (
            <Reveal
              key={segment.id}
              delay={index * 60}
              className="group grid gap-8 border-b border-ink/10 py-10 md:grid-cols-[0.9fr_1.1fr] md:gap-14 md:py-14 lg:grid-cols-[0.85fr_1.15fr]"
            >
              <div className="relative overflow-hidden rounded-2xl">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl border border-ink/12">
                  <SegmentVisual kind={segment.id as "alimentos" | "farma" | "construcao" | "ecommerce"} />
                </div>
                <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-paper px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-ink/70 backdrop-blur">
                  {String(index + 1).padStart(2, "0")} · {segment.kicker}
                </span>
              </div>

              <div className="flex flex-col justify-center">
                <h3 className="display-md max-w-lg text-ink">{segment.title}</h3>
                <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink/55 md:text-base">
                  {segment.body}
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {segment.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-full border border-brand/25 bg-brand-soft px-3 py-1.5 text-[11px] font-medium text-brand-dark"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
                <a
                  href={whatsappLink(`Olá! Quero entender o GetTMS para o segmento de ${segment.kicker}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-medium text-ink/80 transition-colors hover:text-brand-dark"
                >
                  Falar sobre {segment.kicker.toLowerCase()}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

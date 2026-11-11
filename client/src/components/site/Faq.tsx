import { useState } from "react";
import { ArrowUpRight, ChevronDown, Mail, MessageCircle } from "lucide-react";
import { EMAIL, WHATSAPP_DISPLAY, whatsappLink } from "@/content/site";

const QUESTIONS = [
  {
    q: "Como funciona a GetTMS?",
    a: "A GetTMS é um sistema TMS que integra transportadoras, automatiza cotações de frete e centraliza o controle logístico em uma única plataforma.",
  },
  {
    q: "Que tipo de serviço a GetTMS oferece?",
    a: "Gestão de transporte para cargas fracionadas, fechadas e aéreas, com simulações inteligentes e integração de parceiros logísticos.",
  },
  {
    q: "Posso fazer transporte aéreo?",
    a: "Sim. A GetTMS oferece simulação de frete e gestão completa também para transporte aéreo, ideal para entregas urgentes.",
  },
  {
    q: "É possível integrar minhas transportadoras atuais?",
    a: "Sim. O sistema permite integração com as transportadoras que você já utiliza, facilitando a transição e centralizando a gestão.",
  },
  {
    q: "A GetTMS é indicada para qual porte de empresa?",
    a: "De pequenas a grandes operações: a GetTMS é escalável e se adapta à sua demanda logística, sem complicação.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative bg-paper py-16 md:py-24">
      <div className="container-wide grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-10 bg-brand/70" />
            Dúvidas frequentes
          </p>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">
            O que perguntam antes de começar.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/55">
            Ficou com dúvida que não está aqui? Fale com a nossa equipe pelos canais abaixo.
          </p>
          <div className="mt-5 grid gap-2">
            <a
              href={whatsappLink("Olá! Tenho uma dúvida sobre a GetTMS.")}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between rounded-xl border border-ink/10 bg-white/70 px-4 py-3 transition hover:border-brand/50"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/12 text-brand-dark">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[9px] uppercase tracking-[0.18em] text-ink/35">WhatsApp</span>
                  <span className="block text-sm text-ink">{WHATSAPP_DISPLAY}</span>
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-ink/25 group-hover:text-brand-dark" />
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="group flex items-center justify-between rounded-xl border border-ink/10 bg-white/70 px-4 py-3 transition hover:border-brand/50"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/12 text-brand-dark">
                  <Mail className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[9px] uppercase tracking-[0.18em] text-ink/35">E-mail</span>
                  <span className="block text-sm text-ink">{EMAIL}</span>
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-ink/25 group-hover:text-brand-dark" />
            </a>
          </div>
        </div>

        <div className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white/60">
          {QUESTIONS.map((item, index) => {
            const isOpen = open === index;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-display text-[15px] font-semibold text-ink">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-ink/35 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-[13px] leading-relaxed text-ink/60">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

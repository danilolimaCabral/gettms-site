import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Mail, MessageCircle } from "lucide-react";
import Reveal from "./Reveal";
import { DEMO_URL, EMAIL, IMPACT, WHATSAPP_DISPLAY, whatsappLink } from "@/content/site";

export default function FinalCta() {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    volume: "Até 200 fretes/mês",
  });
  const [sent, setSent] = useState(false);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = [
      "Olá! Quero falar com um especialista do GetTMS.",
      `Nome: ${form.name}`,
      `Empresa: ${form.company}`,
      `E-mail: ${form.email}`,
      form.phone ? `WhatsApp: ${form.phone}` : "",
      `Volume de fretes: ${form.volume}`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(whatsappLink(message), "_blank", "noopener");
    setSent(true);
  };

  return (
    <>
      <section className="relative border-y border-ink/10 bg-surface">
        <div className="container-wide grid grid-cols-2 divide-x divide-white/8 md:grid-cols-4">
          {IMPACT.map((item) => (
            <Reveal key={item.value} className="px-4 py-10 first:pl-0 md:px-8">
              <p className="font-display text-[11px] tracking-[0.2em] text-brand-dark">{item.value}</p>
              <p className="mt-3 font-display text-lg font-semibold text-ink">{item.label}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink/45">{item.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="contato" className="relative overflow-hidden py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 grid-fade opacity-50" />
        <div className="container-wide relative">
          <div className="grid gap-14 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
            <Reveal>
              <p className="eyebrow mb-5">Fale com um especialista</p>
              <h2 className="display-lg text-ink">
                Sua logística merece
                <br />
                mais <span className="text-gradient">controle e economia.</span>
              </h2>
              <p className="lede mt-6 max-w-lg">
                Solicite uma demonstração gratuita e veja, com a sua operação, onde o GetTMS reduz custo e
                devolve previsibilidade ao time.
              </p>

              <div className="mt-10 space-y-3">
                <a
                  href={whatsappLink("Olá! Quero agendar uma demonstração do GetTMS.")}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-ink/12 bg-ink/[0.025] px-5 py-4 transition-colors hover:border-brand/40 hover:bg-brand-soft"
                >
                  <span className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
                      <MessageCircle className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[10px] uppercase tracking-[0.2em] text-ink/35">WhatsApp</span>
                      <span className="block text-sm font-medium text-ink">{WHATSAPP_DISPLAY}</span>
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-ink/30 transition-colors group-hover:text-brand-dark" />
                </a>

                <a
                  href={`mailto:${EMAIL}`}
                  className="group flex items-center justify-between rounded-2xl border border-ink/12 bg-ink/[0.025] px-5 py-4 transition-colors hover:border-brand/40 hover:bg-brand-soft"
                >
                  <span className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[10px] uppercase tracking-[0.2em] text-ink/35">E-mail</span>
                      <span className="block text-sm font-medium text-ink">{EMAIL}</span>
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-ink/30 transition-colors group-hover:text-brand-dark" />
                </a>

                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-ink/12 bg-ink/[0.025] px-5 py-4 transition-colors hover:border-brand/40 hover:bg-brand-soft"
                >
                  <span className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[10px] uppercase tracking-[0.2em] text-ink/35">Agenda</span>
                      <span className="block text-sm font-medium text-ink">Escolher horário na agenda</span>
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-ink/30 transition-colors group-hover:text-brand-dark" />
                </a>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <form onSubmit={submit} className="panel p-6 md:p-8">
                <p className="font-display text-lg font-semibold text-ink">Solicitar demonstração</p>
                <p className="mt-1 text-[12px] text-ink/40">
                  Preencha e continue a conversa direto no WhatsApp.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ink/35">Nome</span>
                    <input
                      required
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Seu nome"
                      className="h-11 rounded-xl border border-ink/12 bg-white/5 px-3.5 text-sm text-ink placeholder:text-ink/25 focus:border-brand/60 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ink/35">Empresa</span>
                    <input
                      required
                      value={form.company}
                      onChange={update("company")}
                      placeholder="Nome da empresa"
                      className="h-11 rounded-xl border border-ink/12 bg-white/5 px-3.5 text-sm text-ink placeholder:text-ink/25 focus:border-brand/60 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ink/35">E-mail</span>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="voce@empresa.com.br"
                      className="h-11 rounded-xl border border-ink/12 bg-white/5 px-3.5 text-sm text-ink placeholder:text-ink/25 focus:border-brand/60 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ink/35">WhatsApp</span>
                    <input
                      value={form.phone}
                      onChange={update("phone")}
                      placeholder="(41) 99999-9999"
                      className="h-11 rounded-xl border border-ink/12 bg-white/5 px-3.5 text-sm text-ink placeholder:text-ink/25 focus:border-brand/60 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ink/35">Volume de fretes</span>
                    <select
                      value={form.volume}
                      onChange={update("volume")}
                      className="h-11 rounded-xl border border-ink/12 bg-white/5 px-3 text-sm text-ink focus:border-brand/60 focus:outline-none"
                    >
                      <option>Até 200 fretes/mês</option>
                      <option>200 a 1.000 fretes/mês</option>
                      <option>1.000 a 5.000 fretes/mês</option>
                      <option>Mais de 5.000 fretes/mês</option>
                    </select>
                  </label>
                </div>

                <button type="submit" className="btn btn-primary mt-6 w-full">
                  Continuar no WhatsApp
                  <ArrowUpRight className="h-4 w-4" />
                </button>

                {sent && (
                  <p className="mt-4 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2.5 text-[12px] text-brand-dark">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Abrimos o WhatsApp com seus dados. Se não abriu,{" "}
                    <a href={whatsappLink("Olá! Quero uma demonstração do GetTMS.")} className="underline">
                      clique aqui
                    </a>
                    .
                  </p>
                )}

                <p className="mt-4 text-[10px] leading-relaxed text-ink/25">
                  Seus dados são usados apenas para o contato comercial da GetTMS, conforme a Política de
                  Privacidade.
                </p>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}

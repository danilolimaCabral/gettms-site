import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { DEMO_URL, EMAIL, WHATSAPP_DISPLAY, whatsappLink } from "@/content/site";

export default function ContactScene() {
  const [form, setForm] = useState({ name: "", company: "", email: "", volume: "Até 200 fretes/mês" });
  const [sent, setSent] = useState(false);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((c) => ({ ...c, [field]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = [
      "Olá! Quero falar com um especialista do GetTMS.",
      `Nome: ${form.name}`,
      `Empresa: ${form.company}`,
      `E-mail: ${form.email}`,
      `Volume de fretes: ${form.volume}`,
    ].join("\n");
    window.open(whatsappLink(message), "_blank", "noopener");
    setSent(true);
  };

  return (
    <section id="contato" className="relative bg-[#0b100c]" style={{ height: "125vh" }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(65%_55%_at_60%_45%,rgba(143,224,74,0.14),transparent_72%)]" />
        <div className="container-wide relative grid w-full items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[#8fe04a]">Fale com um especialista</p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-4xl">
              Sua logística com
              <br />
              <span className="text-[#a9ec6a]">controle e economia.</span>
            </h2>
            <div className="mt-8 grid gap-2.5">
              {[
                { icon: MessageCircle, label: "WhatsApp", value: WHATSAPP_DISPLAY, href: whatsappLink("Olá! Quero agendar uma demonstração do GetTMS.") },
                { icon: Mail, label: "E-mail", value: EMAIL, href: `mailto:${EMAIL}` },
                { icon: CheckCircle2, label: "Agenda", value: "Escolher horário", href: DEMO_URL },
              ].map(({ icon: Icon, label, value, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 transition-colors hover:border-[#8fe04a]/50 hover:bg-[#8fe04a]/10"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8fe04a]/15 text-[#a9ec6a]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[9px] uppercase tracking-[0.18em] text-white/35">{label}</span>
                      <span className="block text-sm text-white">{value}</span>
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/30 group-hover:text-[#a9ec6a]" />
                </a>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-white/12 bg-[#0f1712] p-5 md:p-6">
            <p className="font-display text-base font-semibold text-white">Solicitar demonstração</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {[
                { field: "name" as const, label: "Nome", placeholder: "Seu nome", type: "text" },
                { field: "company" as const, label: "Empresa", placeholder: "Nome da empresa", type: "text" },
                { field: "email" as const, label: "E-mail", placeholder: "voce@empresa.com.br", type: "email" },
              ].map(({ field, label, placeholder, type }) => (
                <label key={field} className={`flex flex-col gap-1 ${field === "email" ? "sm:col-span-2" : ""}`}>
                  <span className="text-[9px] uppercase tracking-[0.18em] text-white/35">{label}</span>
                  <input
                    required
                    type={type}
                    value={form[field]}
                    onChange={update(field)}
                    placeholder={placeholder}
                    className="h-10 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/25 focus:border-[#8fe04a]/60 focus:outline-none"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/35">Volume de fretes</span>
                <select
                  value={form.volume}
                  onChange={update("volume")}
                  className="h-10 rounded-lg border border-white/12 bg-[#131b15] px-3 text-sm text-white focus:border-[#8fe04a]/60 focus:outline-none"
                >
                  <option>Até 200 fretes/mês</option>
                  <option>200 a 1.000 fretes/mês</option>
                  <option>1.000 a 5.000 fretes/mês</option>
                  <option>Mais de 5.000 fretes/mês</option>
                </select>
              </label>
            </div>
            <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#8fe04a] py-2.5 text-sm font-semibold text-[#0b100c] hover:bg-[#a9ec6a]">
              Continuar no WhatsApp <ArrowUpRight className="h-4 w-4" />
            </button>
            {sent && (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-[#8fe04a]/30 bg-[#8fe04a]/10 px-3 py-2 text-[11px] text-[#cdf5a6]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Abrimos o WhatsApp com seus dados.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

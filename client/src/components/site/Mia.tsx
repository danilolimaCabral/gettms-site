import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, Sparkles, X } from "lucide-react";
import { DEMO_URL, whatsappLink } from "@/content/site";

type Message = { id: number; from: "mia" | "user"; text: string };

const SUGGESTIONS = ["Como funciona a simulação?", "Quero uma demonstração", "Avaliar minha operação"];

const RULES: { keywords: string[]; reply: string }[] = [
  {
    keywords: ["simul", "cota", "frete", "preço", "valor", "quanto", "custo"],
    reply:
      "A simulação compara prazo, valor e modal entre as transportadoras integradas, usando as suas tabelas e regras comerciais. Você fecha o frete com a melhor relação custo-prazo — e o resultado fica registrado para a aferição depois.",
  },
  {
    keywords: ["rastre", "tracking", "onde está", "status", "entrega"],
    reply:
      "O tracking recebe os eventos das transportadoras e atualiza cada carga automaticamente: coleta, trânsito, ocorrência e entrega. O cliente acompanha por um link próprio, sem precisar ligar para o time.",
  },
  {
    keywords: ["ocorrência", "ocorrencia", "atraso", "avaria", "problema"],
    reply:
      "Cada ocorrência abre uma tratativa com responsável, prazo e histórico. A equipe toda vê o mesmo status — e o cliente é notificado sem depender de alguém lembrar de avisar.",
  },
  {
    keywords: ["fatura", "aferi", "conta frete", "cobrança", "confer"],
    reply:
      "Na aferição, cada CT-e é comparado com o frete contratado. Divergências aparecem antes do pagamento, com o valor a recuperar por transportadora e por período.",
  },
  {
    keywords: ["maturidade", "avalia", "diagnóstico", "diagnostico", "quiz"],
    reply:
      "Posso te levar para a avaliação de maturidade: são 6 perguntas sobre cotação, rastreio, ocorrências, faturas e decisão. A devolutiva é imediata, com o próximo passo sugerido.",
  },
  {
    keywords: ["demo", "demonstra", "agend", "especialista", "contato", "falar"],
    reply:
      "Perfeito. Você pode escolher um horário na agenda do time comercial ou falar agora pelo WhatsApp. Vou deixar os dois atalhos abaixo.",
  },
  {
    keywords: ["aliment", "farma", "e-commerce", "ecommerce", "constru", "segmento"],
    reply:
      "O GetTMS atende alimentos, farma, materiais de construção e e-commerce com a mesma base — mudando o que importa em cada operação: rastreabilidade, priorização de exceções, múltiplos destinos ou prazo por pedido.",
  },
  {
    keywords: ["integra", "erp", "transportadora", "tms"],
    reply:
      "A plataforma integra com as principais transportadoras e com o seu ERP para trocar pedidos, CT-es e eventos sem digitação manual. Quanto mais integrado, menos retrabalho na ponta.",
  },
  {
    keywords: ["relatório", "relatorio", "indicador", "dados", "kpi"],
    reply:
      "Os relatórios consolidam prazo, ocorrências e custo por transportadora, rota e cliente — a base para negociar frete com evidência, não com percepção.",
  },
];

const FALLBACK =
  "Ainda não tenho essa resposta por aqui, mas posso te conectar com um especialista da GetTMS ou te mostrar a avaliação de maturidade da sua operação.";

let messageId = 0;
const nextId = () => {
  messageId += 1;
  return messageId;
};

function replyFor(text: string) {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const rule = RULES.find((item) =>
    item.keywords.some((keyword) =>
      normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    ),
  );
  return rule?.reply ?? FALLBACK;
}

export default function Mia() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      from: "mia",
      text: "Oi! Eu sou a Mia, assistente da GetTMS. Quer entender como reduzir o custo do frete, ver a plataforma funcionando ou avaliar sua operação?",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: nextId(), from: "user", text }]);
    setInput("");
    setTyping(true);

    const answer = replyFor(text);
    const isMaturity = /maturidade|avalia|diagnost/.test(
      text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );

    window.setTimeout(() => {
      setMessages((current) => [...current, { id: nextId(), from: "mia", text: answer }]);
      setTyping(false);
      if (isMaturity) {
        window.setTimeout(() => {
          document.getElementById("maturidade")?.scrollIntoView({ behavior: "smooth" });
          setOpen(false);
        }, 900);
      }
    }, 650 + Math.random() * 350);
  };

  return (
    <>
      <div
        className={`fixed bottom-4 right-4 z-[70] w-[calc(100vw-2rem)] max-w-[380px] origin-bottom-right transition-all duration-400 sm:bottom-6 sm:right-6 ${
          open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
        role="dialog"
        aria-label="Assistente Mia"
        aria-hidden={!open}
      >
        <div className="overflow-hidden rounded-3xl border border-ink/15 bg-[#0f1511]/95 shadow-[0_30px_80px_-25px_rgba(10,15,11,0.35)] backdrop-blur-xl">
          <div className="relative flex items-center gap-3 border-b border-ink/10 bg-gradient-to-r from-[#e9f6dd] to-transparent px-4 py-3.5">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#b6f472] to-[#4f9e22] font-display text-sm font-extrabold text-[#061004]">
              M
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-ink">Mia</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink/40">Assistente GetTMS · online</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/8 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[46vh] min-h-[220px] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    message.from === "user"
                      ? "rounded-br-md bg-brand text-white"
                      : "rounded-bl-md border border-ink/10 bg-ink/[0.04] text-ink/80"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl rounded-bl-md border border-ink/10 bg-ink/[0.04] px-4 py-3">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {messages.length > 0 && !typing && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-brand/25 bg-brand-soft px-2.5 py-1 text-[11px] text-brand-dark transition-colors hover:bg-[#e1f2cf]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-ink/[0.03] px-2.5 py-1 text-[11px] text-ink/70 transition-colors hover:border-brand/40 hover:text-ink"
              >
                <Sparkles className="h-3 w-3 text-brand-dark" /> Agendar demo
              </a>
              <a
                href={whatsappLink("Olá! Falei com a Mia no site e quero falar com um especialista.")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-ink/[0.03] px-2.5 py-1 text-[11px] text-ink/70 transition-colors hover:border-brand/40 hover:text-ink"
              >
                <MessageCircle className="h-3 w-3 text-brand-dark" /> WhatsApp
              </a>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-ink/10 p-3"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escreva sua dúvida…"
              aria-label="Mensagem para a Mia"
              className="h-10 flex-1 rounded-full border border-ink/12 bg-paper px-4 text-[13px] text-ink placeholder:text-ink/25 focus:border-brand/50 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Enviar mensagem"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#b6f472] to-[#63b32e] text-[#061004] transition-transform hover:scale-105 disabled:opacity-40"
              disabled={!input.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Fechar chat da Mia" : "Falar com a Mia"}
        className={`fixed bottom-4 right-4 z-[65] flex items-center gap-2.5 rounded-full border border-brand/30 bg-[#0f1511]/90 py-2 pl-2 pr-4 shadow-[0_18px_45px_-18px_rgba(10,15,11,0.45)] backdrop-blur-xl transition-all duration-300 hover:border-brand/60 sm:bottom-6 sm:right-6 ${
          open ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100"
        }`}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#b6f472] to-[#4f9e22] font-display text-sm font-extrabold text-[#061004]">
          M
          <span className="absolute inset-0 rounded-full border border-brand/50" style={{ animation: "pulse-ring 2.4s ease-out infinite" }} />
        </span>
        <span className="text-left">
          <span className="block font-display text-[12px] font-semibold leading-tight text-ink">Fale com a Mia</span>
          <span className="block text-[10px] leading-tight text-ink/40">Assistente GetTMS</span>
        </span>
      </button>
    </>
  );
}

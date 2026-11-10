import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, RotateCcw, Sparkles } from "lucide-react";
import Reveal from "./Reveal";
import { QUIZ, QUIZ_RESULTS, whatsappLink } from "@/content/site";

const MAX_SCORE = QUIZ.length * 2;

export default function Maturity() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUIZ.map(() => null));
  const [finished, setFinished] = useState(false);

  const score = useMemo(
    () => answers.reduce<number>((total, answer) => total + (answer ?? 0), 0),
    [answers],
  );

  const result = useMemo(
    () => QUIZ_RESULTS.find((item) => score >= item.min && score <= item.max) ?? QUIZ_RESULTS[0],
    [score],
  );

  const answered = answers.filter((answer) => answer !== null).length;
  const progress = finished ? 1 : answered / QUIZ.length;
  const question = QUIZ[step];

  const choose = (value: number) => {
    setAnswers((current) => {
      const next = [...current];
      next[step] = value;
      return next;
    });
    if (step < QUIZ.length - 1) {
      window.setTimeout(() => setStep((current) => Math.min(QUIZ.length - 1, current + 1)), 180);
    } else {
      window.setTimeout(() => setFinished(true), 260);
    }
  };

  const restart = () => {
    setAnswers(QUIZ.map(() => null));
    setStep(0);
    setFinished(false);
  };

  return (
    <section id="maturidade" className="relative py-24 md:py-32">
      <div className="container-wide">
        <div className="panel noise relative overflow-hidden p-6 md:p-12 lg:p-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-soft blur-3xl" />
          <div className="relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <Reveal>
              <p className="eyebrow mb-5">Avalie a maturidade da sua operação</p>
              <h2 className="display-lg text-ink">
                Onde a sua logística
                <br />
                <span className="text-gradient">está perdendo dinheiro?</span>
              </h2>
              <p className="lede mt-6 max-w-md">
                Seis perguntas para identificar oportunidades em fretes, rastreabilidade, ocorrências e
                relatórios. Leva menos de 3 minutos e a devolutiva é imediata.
              </p>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {[
                  { title: "Gestão de fretes integrada", text: "Cotação e tabelas no mesmo lugar." },
                  { title: "Logística automatizada", text: "Eventos sem digitação manual." },
                  { title: "Tudo em um só sistema", text: "Do pedido à fatura aferida." },
                  { title: "Infraestrutura em nuvem", text: "Preparada para alto volume." },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-ink/10 bg-paper p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink/85">
                      <Check className="h-3.5 w-3.5 text-brand-dark" />
                      {item.title}
                    </p>
                    <p className="mt-1 pl-5 text-[12px] text-ink/45">{item.text}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="rounded-2xl border border-ink/12 bg-white/80 p-6 md:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-ink/40">
                    {finished ? "Resultado" : `Pergunta ${step + 1} de ${QUIZ.length}`}
                  </span>
                  <span className="font-display text-[11px] text-brand-dark">
                    {finished ? `${score}/${MAX_SCORE}` : question.hint}
                  </span>
                </div>

                <div className="mb-7 h-1 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#63b32e] to-[#b6f472] transition-all duration-500"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>

                {!finished ? (
                  <div key={step} className="animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
                    <h3 className="font-display text-xl font-semibold leading-snug text-ink md:text-2xl">
                      {question.question}
                    </h3>
                    <div className="mt-6 flex flex-col gap-2.5">
                      {question.options.map((option) => {
                        const selected = answers[step] === option.score;
                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => choose(option.score)}
                            className={`group flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all ${
                              selected
                                ? "border-brand/60 bg-brand-soft text-ink"
                                : "border-ink/12 bg-ink/[0.02] text-ink/70 hover:border-brand/35 hover:bg-brand-soft hover:text-ink"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                selected ? "border-brand bg-brand" : "border-white/25 group-hover:border-brand/60"
                              }`}
                            >
                              {selected && <Check className="h-2.5 w-2.5 text-[#061004]" />}
                            </span>
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setStep((current) => Math.max(0, current - 1))}
                        disabled={step === 0}
                        className="inline-flex items-center gap-2 text-xs text-ink/45 transition-colors hover:text-ink disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (answers[step] === null) return;
                          if (step === QUIZ.length - 1) setFinished(true);
                          else setStep((current) => current + 1);
                        }}
                        disabled={answers[step] === null}
                        className="inline-flex items-center gap-2 text-xs font-medium text-brand-dark transition-opacity disabled:opacity-30"
                      >
                        {step === QUIZ.length - 1 ? "Ver resultado" : "Próxima"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in-0 zoom-in-95 duration-500">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-brand-dark">
                      <Sparkles className="h-3.5 w-3.5" /> Nível de maturidade
                    </div>
                    <h3 className="mt-3 font-display text-3xl font-semibold text-ink">{result.title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-ink/60">{result.body}</p>

                    <div className="mt-6 rounded-xl border border-brand/25 bg-brand-soft p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-brand-dark">Próximo passo sugerido</p>
                      <p className="mt-1.5 text-sm text-ink/80">{result.recommendation}</p>
                    </div>

                    <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#63b32e] to-[#b6f472]"
                        style={{ width: `${Math.round((score / MAX_SCORE) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-ink/35">
                      Pontuação {score} de {MAX_SCORE}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <a
                        href={whatsappLink(
                          `Olá! Fiz a avaliação de maturidade no site (resultado: ${result.title}, ${score}/${MAX_SCORE}) e quero falar com um especialista.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                      >
                        Falar com especialista
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                      <button type="button" onClick={restart} className="btn btn-ghost">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refazer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

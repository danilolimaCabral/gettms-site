import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { QUIZ, QUIZ_RESULTS, whatsappLink } from "@/content/site";

const MAX_SCORE = QUIZ.length * 2;

export default function MaturityScene() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUIZ.map(() => null));
  const [finished, setFinished] = useState(false);

  const score = useMemo(() => answers.reduce<number>((t, a) => t + (a ?? 0), 0), [answers]);
  const result = useMemo(
    () => QUIZ_RESULTS.find((item) => score >= item.min && score <= item.max) ?? QUIZ_RESULTS[0],
    [score],
  );
  const answered = answers.filter((a) => a !== null).length;
  const progress = finished ? 1 : answered / QUIZ.length;
  const question = QUIZ[step];

  const choose = (value: number) => {
    setAnswers((current) => {
      const next = [...current];
      next[step] = value;
      return next;
    });
    if (step < QUIZ.length - 1) window.setTimeout(() => setStep((c) => Math.min(QUIZ.length - 1, c + 1)), 160);
    else window.setTimeout(() => setFinished(true), 240);
  };

  const restart = () => {
    setAnswers(QUIZ.map(() => null));
    setStep(0);
    setFinished(false);
  };

  return (
    <section id="maturidade" className="relative bg-[#0b100c]" style={{ height: "150vh" }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_45%,rgba(143,224,74,0.14),transparent_72%)]" />
        <div className="container-wide relative mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-[#8fe04a]">
            <span>Avalie sua operação</span>
            <span className="text-white/40">{finished ? `${score}/${MAX_SCORE}` : `${step + 1} / ${QUIZ.length}`}</span>
          </div>
          <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#8fe04a] transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>

          {!finished ? (
            <div key={step} className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
              <h2 className="font-display text-2xl font-semibold leading-snug text-white md:text-3xl">{question.question}</h2>
              <div className="mt-6 grid gap-2">
                {question.options.map((option) => {
                  const selected = answers[step] === option.score;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => choose(option.score)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        selected
                          ? "border-[#8fe04a] bg-[#8fe04a]/12 text-white"
                          : "border-white/12 bg-white/[0.03] text-white/70 hover:border-[#8fe04a]/50 hover:text-white"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#8fe04a] bg-[#8fe04a]" : "border-white/25"}`}>
                        {selected && <Check className="h-3 w-3 text-[#0b100c]" />}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep((c) => Math.max(0, c - 1))}
                  disabled={step === 0}
                  className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white disabled:opacity-30"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (answers[step] === null) return;
                    if (step === QUIZ.length - 1) setFinished(true);
                    else setStep((c) => c + 1);
                  }}
                  disabled={answers[step] === null}
                  className="inline-flex items-center gap-2 text-xs font-medium text-[#a9ec6a] disabled:opacity-30"
                >
                  {step === QUIZ.length - 1 ? "Ver resultado" : "Próxima"} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in-0 zoom-in-95 duration-500">
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#8fe04a]">
                <Sparkles className="h-3.5 w-3.5" /> Nível de maturidade
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-white">{result.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">{result.body}</p>
              <div className="mt-5 rounded-xl border border-[#8fe04a]/30 bg-[#8fe04a]/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#a9ec6a]">Próximo passo sugerido</p>
                <p className="mt-1.5 text-sm text-white/80">{result.recommendation}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={whatsappLink(`Olá! Fiz a avaliação no site (${result.title}, ${score}/${MAX_SCORE}) e quero falar com um especialista.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#8fe04a] px-5 py-2.5 text-sm font-semibold text-[#0b100c] hover:bg-[#a9ec6a]"
                >
                  Falar com especialista <ArrowUpRight className="h-4 w-4" />
                </a>
                <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/70 hover:text-white">
                  <RotateCcw className="h-3.5 w-3.5" /> Refazer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

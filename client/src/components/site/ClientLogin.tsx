import { useEffect, useState } from "react";
import { ArrowUpRight, Lock, Mail, X } from "lucide-react";
import { whatsappLink } from "@/content/site";

export default function ClientLogin({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const requestAccess = () => {
    const message = `Olá! Quero acessar o painel do cliente GetTMS.${email ? ` Meu e-mail de cadastro é ${email}.` : ""}`;
    window.open(whatsappLink(message), "_blank", "noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b100c]/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-titulo"
        className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0d1410] p-6 text-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] sm:rounded-3xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8fe04a]">Painel do cliente</p>
            <h2 id="painel-titulo" className="mt-1 font-display text-xl font-semibold tracking-tight">
              Entre na sua operação
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            requestAccess();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">E-mail corporativo</span>
            <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 focus-within:border-[#8fe04a]/60">
              <Mail className="h-4 w-4 text-white/30" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@suaempresa.com.br"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Senha</span>
            <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 focus-within:border-[#8fe04a]/60">
              <Lock className="h-4 w-4 text-white/30" />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
              />
            </span>
          </label>

          <button type="submit" className="btn btn-primary mt-1 w-full justify-center">
            Entrar no painel
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-4 text-[11px] leading-relaxed text-white/40">
          O acesso ao dashboard é liberado para clientes com contrato ativo. Primeiro acesso ou senha esquecida?{" "}
          <button type="button" onClick={requestAccess} className="font-medium text-[#a9ec6a] underline-offset-2 hover:underline">
            fale com nosso time
          </button>
          .
        </p>
      </div>
    </div>
  );
}

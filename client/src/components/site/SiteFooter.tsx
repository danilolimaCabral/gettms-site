import { Facebook, Instagram, Mail, MessageCircle } from "lucide-react";
import Logo from "./Logo";
import {
  CNPJ,
  EMAIL,
  FACEBOOK,
  INSTAGRAM,
  NAV_LINKS,
  WHATSAPP_DISPLAY,
  whatsappLink,
} from "@/content/site";

export default function SiteFooter() {
  return (
    <footer className="relative border-t border-white/8 bg-[#070b08] pt-16">
      <div className="container-wide">
        <div className="grid gap-12 pb-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo tone="light" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/45">
              Plataforma TMS para simular fretes, controlar ocorrências, rastrear cargas e reduzir a conta
              frete com decisões baseadas em dados reais.
            </p>
            <div className="mt-6 flex gap-2">
              <a
                href={whatsappLink("Olá! Vim pelo site da GetTMS.")}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-[#8fe04a]/50 hover:text-[#8fe04a]"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href={FACEBOOK}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-[#8fe04a]/50 hover:text-[#8fe04a]"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={INSTAGRAM}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-[#8fe04a]/50 hover:text-[#8fe04a]"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Navegue</p>
            <ul className="mt-5 space-y-3 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-white/60 transition-colors hover:text-[#8fe04a]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Contato</p>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <a
                  href={whatsappLink("Olá! Vim pelo site da GetTMS.")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-white/60 transition-colors hover:text-[#8fe04a]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex items-center gap-2 text-white/60 transition-colors hover:text-[#8fe04a]"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {EMAIL}
                </a>
              </li>
            </ul>

            <p className="mt-6 text-[10px] uppercase tracking-[0.24em] text-white/35">Institucional</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              <li>
                <a
                  href="https://www.gettms.com.br/pt/sobre-nos/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/50 transition-colors hover:text-[#8fe04a]"
                >
                  A GetLog | GetTMS
                </a>
              </li>
              <li>
                <a
                  href="https://www.gettms.com.br/pt/faq/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/50 transition-colors hover:text-[#8fe04a]"
                >
                  Dúvidas frequentes
                </a>
              </li>
              <li>
                <a
                  href="https://www.gettms.com.br/pt/blog/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/50 transition-colors hover:text-[#8fe04a]"
                >
                  Blog
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/8 py-7 text-[11px] text-white/30 md:flex-row md:items-center md:justify-between">
          <p>
            GETTMS® {new Date().getFullYear()} | Todos os direitos reservados · CNPJ: {CNPJ}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a
              href="https://www.gettms.com.br/pt/politica-de-privacidade/"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white/70"
            >
              Política de privacidade
            </a>
            <a
              href="https://www.gettms.com.br/pt/politica-de-cookie/"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white/70"
            >
              Política de cookies
            </a>
            <a
              href="https://www.gettms.com.br/pt/termos-de-uso/"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white/70"
            >
              Termos de uso
            </a>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <p className="select-none whitespace-nowrap text-center font-display text-[18vw] font-extrabold leading-[0.8] tracking-[-0.06em] text-white/[0.035]">
          getTMS
        </p>
      </div>
    </footer>
  );
}

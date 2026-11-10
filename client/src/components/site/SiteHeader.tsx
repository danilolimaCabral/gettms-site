import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Logo from "./Logo";
import { DEMO_URL, NAV_LINKS } from "@/content/site";

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((link) => document.querySelector(link.href)).filter(
      (element): element is Element => Boolean(element),
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "border-b border-ink/10 bg-paper/85 py-3 backdrop-blur-xl"
            : "border-b border-transparent py-5"
        }`}
      >
        <div className="container-wide flex items-center justify-between gap-6">
          <a href="#top" aria-label="GetTMS — início" className="shrink-0">
            <Logo />
          </a>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Seções do site">
            {NAV_LINKS.map((link) => {
              const isActive = activeId === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "true" : undefined}
                  className={`relative rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
                    isActive ? "text-ink" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute inset-x-3.5 -bottom-0.5 h-[2px] origin-left rounded-full bg-brand transition-transform duration-300 ${
                      isActive ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary hidden !px-5 !py-3 !text-[11px] sm:inline-flex"
            >
              Agendar demonstração
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:border-brand/50 hover:text-brand-dark lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent">
          <div
            className="h-full origin-left bg-gradient-to-r from-[#63b32e] to-[#b6f472] transition-transform duration-150"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-paper/98 backdrop-blur-xl">
          <div className="container-wide flex items-center justify-between py-5">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="container-wide mt-6 flex flex-1 flex-col gap-2" aria-label="Seções do site">
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-baseline justify-between border-b border-ink/10 py-4 font-display text-3xl font-semibold tracking-tight text-ink"
              >
                {link.label}
                <span className="text-[11px] font-normal tracking-[0.2em] text-ink/30">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </a>
            ))}
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary mt-8 w-full"
              onClick={() => setOpen(false)}
            >
              Agendar demonstração
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <p className="mt-6 text-center text-[11px] text-ink/40">
              Ou fale com a Mia no canto da tela
            </p>
          </nav>
        </div>
      )}
    </>
  );
}

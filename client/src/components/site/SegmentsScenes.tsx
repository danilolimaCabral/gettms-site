import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { SEGMENTS, whatsappLink } from "@/content/site";

const KINDS = ["alimentos", "farma", "construcao", "ecommerce"] as const;

export default function SegmentsScenes() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [scene, setScene] = useState(0);
  const [local, setLocal] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
      const n = SEGMENTS.length;
      const idx = Math.min(n - 1, Math.floor(p * n));
      setScene(idx);
      setLocal(Math.min(1, Math.max(0, p * n - idx)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    type SceneHandle = { setSegmentView: (k: string | null) => void; setSegmentZoom: (z: number) => void };
    let cancelled = false;
    let tries = 0;
    const apply = () => {
      if (cancelled) return;
      const handle = (window as unknown as { __gettmsScene?: SceneHandle }).__gettmsScene;
      if (handle) {
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const inView = rect.top < window.innerHeight * 0.9 && rect.bottom > window.innerHeight * 0.1;
        if (inView) {
          handle.setSegmentView(KINDS[scene]);
          handle.setSegmentZoom(0.12);
        }
        return;
      }
      if (tries < 400) {
        tries += 1;
        window.setTimeout(apply, 250);
      }
    };
    apply();
    // reaplica ao rolar e solta a vista quando a secao sai da tela
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.9 && rect.bottom > window.innerHeight * 0.1;
      const handle = (window as unknown as { __gettmsScene?: SceneHandle }).__gettmsScene;
      if (!handle) return;
      if (inView) {
        handle.setSegmentView(KINDS[scene]);
        handle.setSegmentZoom(0.12);
      } else {
        handle.setSegmentView(null);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scene]);

  useEffect(() => () => {
    const handle = (window as unknown as { __gettmsScene?: { setSegmentView: (k: string | null) => void } }).__gettmsScene;
    handle?.setSegmentView(null);
  }, []);

  const segment = SEGMENTS[scene];
  const reveal = Math.min(1, local / 0.22);

  return (
    <section
      id="segmentos"
      ref={sectionRef}
      className="relative bg-transparent"
      style={{ height: `${SEGMENTS.length * 150}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(11,16,12,0.86)_0%,rgba(11,16,12,0.68)_36%,rgba(11,16,12,0.28)_66%,rgba(11,16,12,0.04)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#0b100c]/85 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b100c] to-transparent" />
        <div className="container-wide relative grid w-full items-center">
          <div key={scene} className="max-w-xl animate-in fade-in-0 slide-in-from-bottom-3 duration-500">
            <p className="mb-4 text-[11px] uppercase tracking-[0.22em] text-[#8fe04a]">
              {String(scene + 1).padStart(2, "0")} · {segment.kicker}
            </p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-4xl">
              {segment.title}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">{segment.body}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {segment.highlights.map((h, i) => (
                <li
                  key={h}
                  className="rounded-full border border-white/12 px-3 py-1 text-[11px] text-white/55 transition-all duration-500"
                  style={{
                    opacity: reveal > i * 0.25 ? 1 : 0.15,
                    transform: reveal > i * 0.25 ? "translateY(0)" : "translateY(6px)",
                  }}
                >
                  {h}
                </li>
              ))}
            </ul>
            <a
              href={whatsappLink(`Quero falar sobre ${segment.kicker.toLowerCase()}`)}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#a9ec6a] hover:text-white"
            >
              Falar sobre {segment.kicker.toLowerCase()}
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-[#8fe04a] transition-[width] duration-200"
                  style={{ width: `${((scene + local) / SEGMENTS.length) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-white/40">
                {scene + 1} / {SEGMENTS.length}
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

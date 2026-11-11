export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} aria-hidden="true" fill="none">
      <path
        d="M20 1.6C9.9 1.6 1.7 9.8 1.7 19.9c0 11.6 11.6 24.3 17.1 30.4a1.6 1.6 0 0 0 2.4 0c5.5-6.1 17.1-18.8 17.1-30.4C38.3 9.8 30.1 1.6 20 1.6Z"
        fill="#63B32E"
      />
      <path
        d="M11.4 20.6 17.6 27l11.4-12.2"
        stroke="#ffffff"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({
  className = "",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const word = tone === "light" ? "text-white" : "text-[#4d4d4d]";
  const accent = tone === "light" ? "text-[#8fd63f]" : "text-[#63b32e]";
  return (
    <span className={`inline-flex items-center gap-2 leading-none ${className}`}>
      <LogoMark className="h-9 w-[27.7px] shrink-0" />
      <span className={`font-display text-[1.45rem] leading-none tracking-[-0.01em] ${word}`}>
        <span className="font-medium">get</span>
        <span className={`font-extrabold tracking-[-0.03em] ${accent}`}>TMS</span>
      </span>
    </span>
  );
}

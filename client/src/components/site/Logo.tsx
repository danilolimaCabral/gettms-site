export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="gettms-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9ec6a" />
          <stop offset="0.55" stopColor="#7fd63c" />
          <stop offset="1" stopColor="#4f9e22" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#0a0f0b" />
      <path d="M12 12h24L24 24h12v12H12l12-12H12z" fill="url(#gettms-mark)" />
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
  const wordColor = tone === "light" ? "text-white" : "text-ink";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span
        className={`font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.05em] ${wordColor}`}
      >
        get<span className="text-[#63b32e]">TMS</span>
      </span>
    </span>
  );
}

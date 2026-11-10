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
      <rect x="0.5" y="0.5" width="47" height="47" rx="12" fill="#0a0f0b" />
      <path d="M13 12h22L23 24h12v12H13l12-12H13z" fill="url(#gettms-mark)" />
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
  const word = tone === "light" ? "text-white" : "text-[#16201a]";
  const accent = tone === "light" ? "text-[#a9ec6a]" : "text-[#63b32e]";
  return (
    <span className={`inline-flex items-center gap-2.5 leading-none ${className}`}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <span className={`font-display text-[1.4rem] font-extrabold tracking-[-0.055em] ${word}`}>
        get<span className={accent}>TMS</span>
      </span>
    </span>
  );
}

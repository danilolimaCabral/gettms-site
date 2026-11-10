export function LogoMark({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <img src="/brand/gettms-logo-dark.png" alt="GetTMS" className={`${className} object-contain`} />
  );
}
export default function Logo({
  className = "",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src={tone === "light" ? "/brand/gettms-logo-light.png" : "/brand/gettms-logo-dark.png"}
        alt="GetTMS"
        className="h-9 w-auto object-contain"
      />
    </span>
  );
}

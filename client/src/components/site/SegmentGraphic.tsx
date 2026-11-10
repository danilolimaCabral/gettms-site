type Kind = "alimentos" | "farma" | "construcao" | "ecommerce" | "tracking";

const GREEN = "#63b32e";
const DEEP = "#2f6f4f";
const INK = "#16201a";

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-ink/10 bg-[linear-gradient(150deg,#f7faf2_0%,#eef3e7_55%,#e3ead9_100%)]">
      <svg viewBox="0 0 560 350" className="h-full w-full" role="img" aria-label={label}>
        <defs>
          <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill={INK} opacity="0.12" />
          </pattern>
        </defs>
        <rect width="560" height="350" fill="url(#dots)" opacity="0.6" />
        {children}
      </svg>
    </div>
  );
}

export default function SegmentGraphic({ kind }: { kind: Kind }) {
  if (kind === "alimentos") {
    return (
      <Frame label="Rastreabilidade de alimentos">
        <path d="M120 250h320" stroke={INK} strokeOpacity="0.2" strokeWidth="1.5" />
        <g stroke={DEEP} strokeWidth="2" fill="none">
          <path d="M180 250V170h120v80" />
          <path d="M150 170h180l-18-34H168z" fill="#fff" fillOpacity="0.85" />
          <path d="M210 250v-46h60v46" />
        </g>
        <g fill={GREEN}>
          <circle cx="352" cy="132" r="6" />
          <circle cx="392" cy="176" r="6" />
          <circle cx="432" cy="220" r="6" />
        </g>
        <path d="M352 132 392 176 432 220" stroke={GREEN} strokeWidth="2" strokeDasharray="6 6" fill="none" />
        <path d="M110 250h340" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
        <rect x="330" y="96" width="150" height="40" rx="20" fill="#fff" stroke={INK} strokeOpacity="0.12" />
        <text x="405" y="121" textAnchor="middle" fontSize="14" fill={INK} fillOpacity="0.7" fontFamily="Inter, sans-serif">
          Pedido rastreado
        </text>
      </Frame>
    );
  }

  if (kind === "farma") {
    return (
      <Frame label="Controle de transporte farmacêutico">
        <rect x="150" y="120" width="260" height="130" rx="14" fill="#fff" stroke={DEEP} strokeWidth="2" />
        <rect x="150" y="120" width="260" height="26" rx="13" fill={GREEN} fillOpacity="0.9" />
        <path d="M280 168v52M254 194h52" stroke={GREEN} strokeWidth="10" strokeLinecap="round" />
        <g stroke={INK} strokeOpacity="0.35" strokeWidth="1.5" fill="none">
          <path d="M120 282h320" />
          <path d="M96 282h-24M488 282h-24" />
        </g>
        <g fill={INK} fillOpacity="0.55" fontSize="12" fontFamily="Inter, sans-serif">
          <text x="150" y="304">-2 °C a 8 °C</text>
          <text x="356" y="304">lote conferido</text>
        </g>
        <circle cx="452" cy="96" r="16" fill={GREEN} fillOpacity="0.15" />
        <circle cx="452" cy="96" r="6" fill={GREEN} />
      </Frame>
    );
  }

  if (kind === "construcao") {
    return (
      <Frame label="Materiais de construção em múltiplos destinos">
        <path d="M120 258h320" stroke={INK} strokeOpacity="0.2" strokeWidth="1.5" />
        <g stroke={DEEP} strokeWidth="2" fill="#fff">
          <rect x="150" y="226" width="90" height="32" rx="3" />
          <rect x="170" y="194" width="90" height="32" rx="3" />
          <rect x="140" y="162" width="90" height="32" rx="3" />
        </g>
        <path d="M300 258V150" stroke={GREEN} strokeWidth="3" />
        <path d="M300 150h110" stroke={GREEN} strokeWidth="3" strokeDasharray="8 8" />
        <path d="M300 150h110" stroke={GREEN} strokeWidth="3" strokeDasharray="8 8" transform="rotate(24 300 150)" />
        <g fill={INK} fillOpacity="0.6" fontSize="12" fontFamily="Inter, sans-serif">
          <text x="322" y="140">obra</text>
          <text x="368" y="182">loja</text>
        </g>
        <circle cx="300" cy="258" r="7" fill={GREEN} />
      </Frame>
    );
  }

  if (kind === "ecommerce") {
    return (
      <Frame label="Frete e prazo para e-commerce">
        <rect x="132" y="128" width="170" height="130" rx="8" fill="#fff" stroke={DEEP} strokeWidth="2" />
        <path d="M132 166h170" stroke={DEEP} strokeWidth="2" />
        <path d="M217 128v38" stroke={DEEP} strokeWidth="2" />
        <rect x="330" y="96" width="96" height="172" rx="16" fill="#fff" stroke={INK} strokeWidth="2" />
        <rect x="344" y="118" width="68" height="96" rx="6" fill="#f2f7ec" />
        <g stroke={GREEN} strokeWidth="4" strokeLinecap="round">
          <path d="M356 140h44M356 158h30M356 176h38" />
        </g>
        <rect x="344" y="226" width="68" height="24" rx="12" fill={GREEN} />
        <g fill={INK} fillOpacity="0.55" fontSize="12" fontFamily="Inter, sans-serif">
          <text x="132" y="288">cotação comparada</text>
        </g>
      </Frame>
    );
  }

  return (
    <Frame label="Central de operações com rotas monitoradas">
      <g stroke={INK} strokeOpacity="0.14" strokeWidth="1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={`h${i}`} d={`M60 ${90 + i * 40}H500`} />
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path key={`v${i}`} d={`M${80 + i * 66} 70V290`} />
        ))}
      </g>
      <g fill="#fff" stroke={INK} strokeOpacity="0.18">
        <rect x="100" y="100" width="60" height="40" rx="3" />
        <rect x="200" y="180" width="80" height="52" rx="3" />
        <rect x="330" y="110" width="70" height="46" rx="3" />
        <rect x="400" y="200" width="66" height="60" rx="3" />
      </g>
      <path d="M130 210 230 210 300 150 400 150 430 220" stroke={GREEN} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g fill={GREEN}>
        <circle cx="130" cy="210" r="7" />
        <circle cx="300" cy="150" r="7" />
        <circle cx="430" cy="220" r="7" />
      </g>
      <g fill={DEEP}>
        <circle cx="230" cy="210" r="5" />
        <circle cx="400" cy="150" r="5" />
      </g>
    </Frame>
  );
}

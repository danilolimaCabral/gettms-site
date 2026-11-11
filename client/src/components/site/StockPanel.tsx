import { useEffect, useMemo, useState } from "react";
import { Boxes, Check, ChevronRight, PackageCheck, Truck, Warehouse } from "lucide-react";

type StockStatus = "estoque" | "reservado" | "carregando" | "carregado";

type StockItem = {
  code: string;
  name: string;
  qty: number;
  unit: string;
  slot: string;
  batch: string;
  status: StockStatus;
};

const BASE_ITEMS: StockItem[] = [
  { code: "PAL-2214", name: "Pallet misto · alimentos", qty: 48, unit: "cx", slot: "A-01", batch: "L2428", status: "carregando" },
  { code: "PAL-3391", name: "Bebidas 12×1 L", qty: 120, unit: "cx", slot: "A-04", batch: "L2411", status: "reservado" },
  { code: "PAL-4410", name: "Medicamentos · 2–8 °C", qty: 36, unit: "cx", slot: "B-02", batch: "L2502", status: "carregando" },
  { code: "PAL-5527", name: "Materiais de construção", qty: 64, unit: "un", slot: "C-03", batch: "L2380", status: "estoque" },
  { code: "PAL-6688", name: "E-commerce · pedidos leves", qty: 210, unit: "un", slot: "D-01", batch: "L2519", status: "reservado" },
  { code: "PAL-7742", name: "Higiene e limpeza", qty: 92, unit: "cx", slot: "B-06", batch: "L2433", status: "estoque" },
  { code: "PAL-8830", name: "Fracionado · lojas", qty: 54, unit: "cx", slot: "C-01", batch: "L2447", status: "estoque" },
];

const STATUS_LABEL: Record<StockStatus, string> = {
  estoque: "Em estoque",
  reservado: "Reservado",
  carregando: "Carregando",
  carregado: "Carregado",
};

const STATUS_CLASS: Record<StockStatus, string> = {
  estoque: "bg-white/10 text-white/65",
  reservado: "bg-[#f0c46b]/15 text-[#f3cf8c]",
  carregando: "bg-[#8fe04a]/18 text-[#b7f27f]",
  carregado: "bg-[#8fe04a] text-[#0b100c]",
};

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "carregando", label: "Carregando" },
  { id: "reservado", label: "Reservado" },
  { id: "estoque", label: "Estoque" },
] as const;

export default function StockPanel({ active, progress }: { active: boolean; progress: number }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todos");
  const [selected, setSelected] = useState<string>("PAL-2214");
  const [open, setOpen] = useState(false);

  // durante a doca o painel abre sozinho
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  // progresso dentro do capítulo da doca (0 → 1)
  const local = Math.min(1, Math.max(0, (progress - 0.835) / (0.9 - 0.835)));

  const items = useMemo(() => {
    return BASE_ITEMS.map((item, index) => {
      if (index === 0 && local > 0.65) return { ...item, status: "carregado" as StockStatus, qty: 0 };
      if (index === 2 && local > 0.8) return { ...item, status: "carregado" as StockStatus, qty: 0 };
      if (item.status === "reservado" && local > 0.45) return { ...item, status: "carregando" as StockStatus };
      return item;
    });
  }, [local]);

  const visible = items.filter((item) => filter === "todos" || item.status === filter);
  const detail = items.find((item) => item.code === selected) ?? items[0];
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);
  const loadingUnits = items.filter((i) => i.status === "carregando").reduce((s, i) => s + i.qty, 0);
  const occupancy = Math.round(74 + Math.sin(local * Math.PI) * 6);
  const truckFill = Math.round(Math.min(100, 12 + local * 88));

  return (
    <div
      className={`pointer-events-auto absolute inset-x-3 bottom-4 z-20 transition-all duration-500 md:inset-x-auto md:right-6 md:top-24 md:bottom-auto md:w-[340px] ${
        open && active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0 md:-translate-y-2 md:translate-x-4"
      }`}
      aria-hidden={!(open && active)}
    >
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0b110d]/92 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8fe04a]/15 text-[#a9ec6a]">
              <Warehouse className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Estoque interno</p>
              <p className="font-display text-sm font-semibold text-white">CD GETTMS · Doca 04</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#8fe04a]/12 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[#a9ec6a]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fe04a]" /> ao vivo
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          {[
            { icon: Boxes, label: "Unidades", value: totalUnits.toLocaleString("pt-BR") },
            { icon: Truck, label: "Carregando", value: loadingUnits.toLocaleString("pt-BR") },
            { icon: PackageCheck, label: "Ocupação", value: `${occupancy}%` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
              <Icon className="mb-1 h-3.5 w-3.5 text-white/35" />
              <p className="font-display text-sm font-semibold leading-none text-white">{value}</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/35">{label}</p>
            </div>
          ))}
        </div>

        <div className="px-4">
          <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-white/35">
            <span>Carga do caminhão</span>
            <span className="text-[#a9ec6a]">{truckFill}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#8fe04a] transition-[width] duration-500" style={{ width: `${truckFill}%` }} />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                filter === item.id ? "bg-[#8fe04a] text-[#0b100c]" : "bg-white/6 text-white/55 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <ul className="max-h-[176px] overflow-y-auto px-2 pb-2 md:max-h-[220px]">
          {visible.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                onClick={() => setSelected(item.code)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                  selected === item.code ? "bg-white/8" : "hover:bg-white/5"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-display text-[10px] font-semibold text-white/60">
                  {item.slot}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-white/85">{item.name}</span>
                  <span className="block text-[10px] text-white/35">
                    {item.qty} {item.unit} · lote {item.batch}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${STATUS_CLASS[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="px-3 py-6 text-center text-[11px] text-white/35">Nada neste status agora.</li>}
        </ul>

        <div className="border-t border-white/8 bg-white/[0.02] px-4 py-3">
          <p className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-white/35">Detalhe do volume</p>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-xs font-semibold text-white">{detail.code}</p>
              <p className="truncate text-[10px] text-white/40">
                Endereço {detail.slot} · lote {detail.batch}
              </p>
            </div>
            {detail.status === "carregado" ? (
              <span className="flex items-center gap-1 rounded-full bg-[#8fe04a]/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#b7f27f]">
                <Check className="h-3 w-3" /> no caminhão
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
                {STATUS_LABEL[detail.status]}
                <ChevronRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
